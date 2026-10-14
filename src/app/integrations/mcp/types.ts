import type { CredentialRef } from '@/app/settings/credentials/types'

export type MCPConnectionID = `mcp-${string}`

export type MCPHTTPTransport = {
  type: 'streamable-http'
  url: string
}

export type MCPLocalTransport = {
  type: 'stdio'
  command: string
  args: string[]
  /** Values live in the credential store, including environments imported from IDEs. */
  environment?: CredentialRef
}

export type MCPAuthentication = { type: 'none' } | { type: 'bearer'; credentialRef: CredentialRef }

export type MCPConnection = {
  id: MCPConnectionID
  name: string
  enabled: boolean
  transport: MCPHTTPTransport | MCPLocalTransport
  authentication: MCPAuthentication
  autoApprove?: string[]
}

export type MCPConnectionSettings = {
  version: 1
  connections: MCPConnection[]
}

export type MCPConnectionDraft = {
  id: MCPConnectionID | null
  name: string
  url: string
  enabled: boolean
  authenticationType: MCPAuthentication['type']
  transportType?: 'streamable-http' | 'stdio'
  command?: string
  args?: string[]
  autoApprove?: string[]
  hasEnvironment?: boolean
}
