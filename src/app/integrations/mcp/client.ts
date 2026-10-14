import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'

import { IS_TAURI } from '@open-pencil/core/constants'

import { appCredentialServices } from '@/app/settings/credentials/app'
import { tauriFetch } from '@/app/tauri/http'

import { resolveMCPEnvironment } from './environment'
import { LocalMCPTransport } from './local-transport'
import type { MCPConnection } from './types'

export async function connectMCP(
  connection: MCPConnection,
  signal?: AbortSignal,
  overrides?: {
    environment?: Record<string, string>
    bearer?: string
  }
) {
  if (connection.transport.type === 'stdio' && !IS_TAURI) {
    throw new Error('Local MCP servers require the desktop app.')
  }
  const client = new Client({ name: 'OpenPencil', version: '1.0.0' }, { capabilities: {} })
  const abort = () => {
    void client.close().catch(() => undefined)
  }
  signal?.throwIfAborted()
  signal?.addEventListener('abort', abort, { once: true })
  try {
    const headers: Record<string, string> = {}
    if (overrides?.bearer) headers.Authorization = `Bearer ${overrides.bearer}`
    if (connection.authentication.type === 'bearer') {
      const token =
        overrides?.bearer ??
        (await appCredentialServices.resolver.resolve(connection.authentication.credentialRef))
      if (!token) throw new Error('The MCP connection needs a bearer token.')
      headers.Authorization = `Bearer ${token}`
    }
    const transport =
      connection.transport.type === 'stdio'
        ? new LocalMCPTransport({
            command: connection.transport.command,
            args: connection.transport.args,
            env: overrides?.environment ?? (await resolveMCPEnvironment(connection))
          })
        : new StreamableHTTPClientTransport(new URL(connection.transport.url), {
            fetch: IS_TAURI ? tauriFetch : undefined,
            requestInit: { headers }
          })
    signal?.throwIfAborted()
    await client.connect(transport, { timeout: 15_000 })
    const { tools } = await client.listTools({}, { signal, timeout: 15_000 })
    return {
      client,
      tools,
      async close() {
        signal?.removeEventListener('abort', abort)
        await client.close()
      }
    }
  } catch (error) {
    signal?.removeEventListener('abort', abort)
    await client.close()
    throw error
  }
}
