import type { McpServer } from '@agentclientprotocol/sdk'

import { MANAGED_CHAT_HEADER } from '@open-pencil/core/constants'

import { getMCPServerURL } from '@/app/automation/mcp/endpoint'
import { describeDiagnosticError, recordMCPConnectionFailure } from '@/app/diagnostics'
import { appCredentialServices } from '@/app/settings/credentials/app'

import { resolveMCPEnvironment } from './environment'
import { MCPConnectionError } from './failure'
import { enabledMCPConnections } from './store'
import type { MCPConnection } from './types'
export type BuiltInMCPServerOptions = {
  authorizationToken: string | null
  chatId?: string
  connectionIds?: readonly string[]
}

export function builtInMCPServer(options: BuiltInMCPServerOptions): McpServer {
  return {
    type: 'http',
    name: 'open-pencil',
    url: getMCPServerURL(),
    headers: [
      ...(options.authorizationToken
        ? [{ name: 'Authorization', value: `Bearer ${options.authorizationToken}` }]
        : []),
      ...(options.chatId ? [{ name: MANAGED_CHAT_HEADER, value: options.chatId }] : [])
    ]
  }
}

async function externalMCPServer(connection: MCPConnection): Promise<McpServer> {
  if (connection.transport.type === 'stdio') {
    return {
      name: connection.name,
      command: connection.transport.command,
      args: connection.transport.args,
      env: Object.entries(await resolveMCPEnvironment(connection)).map(([name, value]) => ({
        name,
        value
      }))
    }
  }
  const headers = []
  if (connection.authentication.type === 'bearer') {
    try {
      const token = await appCredentialServices.resolver.resolve(
        connection.authentication.credentialRef
      )
      if (!token) throw new Error('MCP connection needs a bearer token')
      headers.push({ name: 'Authorization', value: `Bearer ${token}` })
    } catch (error) {
      recordMCPConnectionFailure({ operation: 'connect', ...describeDiagnosticError(error) })
      throw error
    }
  }
  return {
    type: 'http',
    name: connection.name,
    url: connection.transport.url,
    headers
  }
}

export async function buildACPMCPServers(options: BuiltInMCPServerOptions): Promise<McpServer[]> {
  const connections = enabledMCPConnections.value.filter(
    (connection) => !options.connectionIds || options.connectionIds.includes(connection.id)
  )
  const external = await Promise.all(
    connections.map(async (connection) => {
      try {
        return await externalMCPServer(connection)
      } catch (error) {
        throw new MCPConnectionError(connection.name, error)
      }
    })
  )
  return [builtInMCPServer(options), ...external]
}
