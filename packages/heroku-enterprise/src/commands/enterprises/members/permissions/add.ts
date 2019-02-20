import {color} from '@heroku-cli/color'
import {flags} from '@heroku-cli/command'
import {cli} from 'cli-ux'

import BaseCommand from '../../../../base'
import {Accounts} from '../../../../completions'

export default class Add extends BaseCommand {
  static description = 'adds permissions to the member of an enterprise account'

  static examples = [
    '$ heroku enterprises:members:permissions:add member-name --enterprise-account=account-name --permissions=billing,create,manage,view',
  ]

  static args = [
    {name: 'email', required: true},
  ]

  static flags = {
    'enterprise-account': flags.string({
      completion: Accounts,
      char: 'e',
      description: 'enterprise account name',
      required: true
    }),

    permissions: flags.string({
      char: 'p',
      description: 'permissions to grant the member (comma-separated)',
      required: true
    }),
  }

  async run() {
    const {args, flags} = this.parse(Add)
    const enterpriseAccount = flags['enterprise-account']
    const member = args.email
    const permissions = flags.permissions.split(',')
    const formattedEmail = color.cyan(member)

    try {
      const permissionsAudit = await this.getUpdatedPermissions(enterpriseAccount, member, permissions)
      const formattedOriginalPerms = color.cyan(`${permissionsAudit.original}`)
      const formattedModifiedPerms = color.cyan(`${permissionsAudit.modified}`)

      cli.action.start(`Updating permissions for ${formattedEmail} from ${formattedOriginalPerms} to ${formattedModifiedPerms}`)
      const params = {body: {permissions: permissionsAudit.modified}}
      await this.heroku.patch(`/enterprise-accounts/${enterpriseAccount}/members/${member}`, params)
      cli.action.stop()
    } catch (err) {
      throw err
    }
  }

  async getUpdatedPermissions(enterpriseAccount: string, memberEmail: string, newPermissions: string[]): Promise<({original: string[], modified: string[]})> {
    const permissions: Set<string> = new Set(newPermissions)
    const originalPermissions: string[] = []

    const {body: members} = await this.heroku.get<any[]>(`/enterprise-accounts/${enterpriseAccount}/members`)
    const member = members.filter((member: any) => member.user.email === memberEmail)
    if (member.length === 0) {
      cli.error(this.getUnknownUserErrorMessage(memberEmail, enterpriseAccount))
    }

    member[0].permissions.forEach((permission: any) => {
      originalPermissions.push(permission.name)
      permissions.add(permission.name)
    })

    return {original: originalPermissions, modified: [...permissions]}
  }

  getUnknownUserErrorMessage(memberEmail: string, enterpriseAccount: string): string {
    const formattedEmail = color.cyan(memberEmail)
    const formattedAccount = color.green(enterpriseAccount)

    return `${formattedEmail} is not a member of ${formattedAccount}
First add the member: heroku enterprises:members:add ${memberEmail} --enterprise-account=${enterpriseAccount} --permissions=billing,create,manage,view`
  }
}