/**
 * Browser-side automation handler.
 *
 * Connects to the bridge via WebSocket, receives RPC requests,
 * executes them against the live EditorStore, and sends results back.
 */
import * as v from 'valibot'

import { randomHex } from '@open-pencil/core/random'
import { RPCTrace, rpcTraceIdentity, type RPCStage } from '@open-pencil/mcp/diagnostics'

import { createAutomationDiagnostics } from '@/app/automation/bridge/diagnostics'
import { makeFigmaFromStore } from '@/app/automation/bridge/figma-factory'
import { createAutomationCommandHandlers } from '@/app/automation/bridge/handlers'
import { getAutomationWebSocketURL } from '@/app/automation/mcp/endpoint'
import type { EditorStore } from '@/app/editor/active-store'

/** Requests from the MCP bridge; other message types (such as the register prompt) are ignored. */
const AutomationRequest = v.object({
  type: v.literal('request'),
  id: v.pipe(v.string(), v.nonEmpty()),
  command: v.string(),
  args: v.optional(v.unknown()),
  managedChatId: v.optional(v.string())
})
const AutomationMessageJSON = v.pipe(
  v.string(),
  v.parseJson(),
  v.variant('type', [AutomationRequest, RPCTrace])
)

export function connectAutomation(
  getStore: () => EditorStore,
  authToken: string | null = null,
  automationURL = getAutomationWebSocketURL()
) {
  const token = authToken ?? randomHex(32)
  let ws: WebSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined
  let intentionalDisconnect = false
  const diagnostics = createAutomationDiagnostics(getStore, (enabled) => {
    if (ws?.readyState === WebSocket.OPEN)
      ws.send(JSON.stringify({ type: 'trace_config', enabled }))
  })

  const { handleRequest: handleAutomationRequest } =
    createAutomationCommandHandlers(makeFigmaFromStore)

  async function handleRequest(
    command: string,
    args: unknown,
    managedChatId?: string,
    progress?: (stage: RPCStage) => void
  ): Promise<unknown> {
    return handleAutomationRequest(getStore(), command, args, managedChatId, progress)
  }

  function connect() {
    let socket: WebSocket
    try {
      socket = new WebSocket(automationURL)
      ws = socket
    } catch (e) {
      console.error(
        '[Automation] WebSocket constructor failed:',
        e instanceof Error ? e.message : e
      )
      scheduleReconnect()
      return
    }

    socket.onopen = () => {
      console.debug('[Automation] WebSocket connected to MCP server')
      socket.send(JSON.stringify({ type: 'register', token, traceEnabled: diagnostics.enabled() }))
      diagnostics.runtime('connected')
    }

    socket.onmessage = async (event) => {
      try {
        const parsed = v.safeParse(AutomationMessageJSON, event.data)
        if (!parsed.success) {
          if (parsed.issues.some((issue) => issue.type === 'parse_json'))
            console.warn('Failed to parse WebSocket message:', v.summarize(parsed.issues))
          return
        }
        if (parsed.output.type === 'rpc_trace') {
          diagnostics.trace.helper(parsed.output)
          return
        }
        const msg = parsed.output
        diagnostics.trace.start(msg.id, rpcTraceIdentity(msg))
        const progress = (stage: RPCStage) => {
          if (!diagnostics.enabled()) return
          diagnostics.trace.stage(msg.id, stage)
          try {
            if (socket.readyState === WebSocket.OPEN)
              socket.send(
                JSON.stringify({ type: 'progress', id: msg.id, stage, timestamp: Date.now() })
              )
          } catch {
            console.warn('[MCP diagnostics] Could not send request progress')
          }
        }
        progress('received')
        try {
          const result = await handleRequest(msg.command, msg.args, msg.managedChatId, progress)
          progress('completed')
          if (socket.readyState !== WebSocket.OPEN) return
          progress('responding')
          socket.send(JSON.stringify({ type: 'response', id: msg.id, ...(result as object) }))
        } catch (e) {
          progress('failed')
          if (socket.readyState !== WebSocket.OPEN) return
          socket.send(
            JSON.stringify({
              type: 'response',
              id: msg.id,
              ok: false,
              error: e instanceof Error ? e.message : String(e)
            })
          )
        } finally {
          diagnostics.trace.finish(msg.id)
        }
      } catch (e) {
        console.warn('Failed to parse WebSocket message:', e)
      }
    }

    socket.onclose = (event) => {
      diagnostics.runtime('disconnected', { code: event.code, clean: event.wasClean })
      if (ws === socket) ws = null
      if (intentionalDisconnect || event.code === 1000) return
      console.warn('[Automation] WebSocket closed:', `code=${event.code} reason=${event.reason}`)
      scheduleReconnect()
    }

    socket.onerror = (event) => {
      diagnostics.runtime('socket-error')
      console.warn('[Automation] WebSocket error:', event)
      socket.close()
    }
  }

  function scheduleReconnect() {
    clearTimeout(reconnectTimer)
    reconnectTimer = setTimeout(connect, 2000)
  }

  function disconnect() {
    intentionalDisconnect = true
    clearTimeout(reconnectTimer)
    ws?.close()
    ws = null
    diagnostics.dispose()
  }

  connect()
  return { disconnect, token }
}
