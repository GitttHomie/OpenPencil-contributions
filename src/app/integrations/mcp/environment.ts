import { appCredentialServices } from '@/app/settings/credentials/app'
import { credentialRef } from '@/app/settings/credentials/reference'

import { parseMCPEnvironment } from './configuration'
import type { MCPConnection, MCPConnectionID } from './types'

export function mcpEnvironmentRef(id: MCPConnectionID) {
  return credentialRef('mcp', 'environment', id)
}

export async function resolveMCPEnvironment(connection: MCPConnection) {
  if (connection.transport.type !== 'stdio' || !connection.transport.environment) return {}
  const value = await appCredentialServices.resolver.resolve(mcpEnvironmentRef(connection.id))
  if (value === null)
    throw new Error('The MCP environment is unavailable. Re-enter it in Settings.')
  return parseMCPEnvironment(value)
}

export async function saveMCPEnvironment(id: MCPConnectionID, text: string) {
  const values = parseMCPEnvironment(text)
  await appCredentialServices.manager.set(mcpEnvironmentRef(id), JSON.stringify(values))
}
