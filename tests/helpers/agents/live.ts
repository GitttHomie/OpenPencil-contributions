import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable, Writable } from 'node:stream'

import {
  ClientSideConnection,
  ndJsonStream,
  PROTOCOL_VERSION,
  type McpServer,
  type RequestPermissionRequest,
  type SessionUpdate
} from '@agentclientprotocol/sdk'

import type { ACPAgentDef } from '@open-pencil/core/constants'

const canvasTools = new Set([
  'get_selection',
  'list_documents',
  'describe',
  'get_components',
  'list_available_fonts',
  'render',
  'eval',
  'export',
  'find_nodes'
])

function isTestCanvasPermission(request: RequestPermissionRequest, serverName: string): boolean {
  const kiro = request._meta?.kiro
  if (typeof kiro !== 'object' || kiro === null || !('consent' in kiro)) return false
  const consent = kiro.consent
  if (typeof consent !== 'object' || consent === null) return false
  if (!('capability' in consent) || consent.capability !== 'mcp') return false
  if (!('resource' in consent) || typeof consent.resource !== 'string') return false
  return [...canvasTools].some((tool) => consent.resource === `${serverName}/${tool}`)
}

/** An opt-in live CLI session, scoped to a temporary directory and test-owned MCP server. */
export async function runCanvasAgent(agent: ACPAgentDef, mcpServer: McpServer, request: string) {
  const cwd = await mkdtemp(join(tmpdir(), 'open-pencil-live-agent-'))
  const child = spawn(agent.command, agent.args, { cwd, stdio: 'pipe' })
  const updates: SessionUpdate[] = []
  const permissions: RequestPermissionRequest[] = []
  child.stderr.resume()
  const connection = new ClientSideConnection(
    () => ({
      async sessionUpdate({ update }) {
        updates.push(update)
      },
      async requestPermission(request) {
        permissions.push(request)
        // Use Kiro's consent capability/resource, never a tool title or MCP annotation.
        const option = isTestCanvasPermission(request, mcpServer.name)
          ? request.options.find((option) => option.kind === 'allow_once')
          : undefined
        return {
          outcome: option
            ? { outcome: 'selected', optionId: option.optionId }
            : { outcome: 'cancelled' }
        }
      },
      extNotification: async () => undefined
    }),
    ndJsonStream(
      Writable.toWeb(child.stdin) as WritableStream<Uint8Array>,
      Readable.toWeb(child.stdout) as ReadableStream<Uint8Array>
    )
  )
  const timer = setTimeout(() => child.kill('SIGTERM'), 120_000)
  try {
    await connection.initialize({ protocolVersion: PROTOCOL_VERSION, clientCapabilities: {} })
    const session = await connection.newSession({ cwd, mcpServers: [mcpServer] })
    const result = await connection.prompt({
      sessionId: session.sessionId,
      prompt: [{ type: 'text', text: request }]
    })
    return { result, updates, permissions }
  } finally {
    clearTimeout(timer)
    child.kill('SIGTERM')
    await connection.closed
    await rm(cwd, { recursive: true, force: true })
  }
}
