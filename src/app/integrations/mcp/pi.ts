import { getMCPServerURL } from '@/app/automation/mcp/endpoint'
import { getAutomationAuthToken } from '@/app/automation/mcp/spawn'
import { describeDiagnosticError, recordMCPConnectionFailure } from '@/app/diagnostics'
import { appCredentialServices } from '@/app/settings/credentials/app'

import { resolveMCPEnvironment } from './environment'
import { enabledMCPConnections } from './store'
import type { MCPConnection } from './types'
export type PiMCPServer =
  | {
      url: string
      headers?: Record<string, string>
      auth: false
    }
  | { command: string; args: string[]; env: Record<string, string> }

async function externalPiMCPServer(connection: MCPConnection): Promise<PiMCPServer> {
  if (connection.transport.type === 'stdio') {
    return {
      command: connection.transport.command,
      args: connection.transport.args,
      env: await resolveMCPEnvironment(connection)
    }
  }
  const headers: Record<string, string> = {}
  if (connection.authentication.type === 'bearer') {
    try {
      const token = await appCredentialServices.resolver.resolve(
        connection.authentication.credentialRef
      )
      if (!token) throw new Error('MCP connection needs a bearer token')
      headers.Authorization = `Bearer ${token}`
    } catch (error) {
      recordMCPConnectionFailure({ operation: 'connect', ...describeDiagnosticError(error) })
      throw error
    }
  }
  return {
    url: connection.transport.url,
    ...(Object.keys(headers).length ? { headers } : {}),
    auth: false
  }
}

export async function buildPiMCPServers(options?: {
  authorizationToken?: string | null
  connectionIds?: readonly string[]
}): Promise<Record<string, PiMCPServer>> {
  const authorizationToken =
    options && 'authorizationToken' in options
      ? options.authorizationToken
      : await getAutomationAuthToken()
  const entries = await Promise.all(
    enabledMCPConnections.value
      .filter(
        (connection) => !options?.connectionIds || options.connectionIds.includes(connection.id)
      )
      .map(async (connection) => [connection.name, await externalPiMCPServer(connection)] as const)
  )
  return {
    ...Object.fromEntries(entries),
    'open-pencil': {
      url: getMCPServerURL(),
      ...(authorizationToken ? { headers: { Authorization: `Bearer ${authorizationToken}` } } : {}),
      auth: false
    }
  }
}
