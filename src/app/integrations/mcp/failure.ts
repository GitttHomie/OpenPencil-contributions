import { CredentialStoreError } from '@/app/settings/credentials/types'

/** Keep external connection failures separate from the editor's canvas server. */
export class MCPConnectionError extends Error {
  readonly credentialAccess: boolean

  constructor(
    readonly connectionName: string,
    error: unknown
  ) {
    super(`Could not prepare MCP connection "${connectionName}".`)
    this.name = 'MCPConnectionError'
    this.credentialAccess = error instanceof CredentialStoreError
  }
}
