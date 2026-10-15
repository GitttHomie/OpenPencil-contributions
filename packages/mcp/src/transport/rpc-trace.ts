import { randomUUID } from 'node:crypto'

import { rpcTraceIdentity, type RPCTrace, type RPCStage } from '#mcp/diagnostics'

const MAX_TRACE_EVENTS = 256
const MAX_RECENT_REQUESTS = 256
type RequestTrace = {
  requestId: string
  command: string
  tool?: string
  managedChatId?: string
  started: number
  appStage?: RPCStage
  appTimestamp?: number
}

/** Bounded metadata only; neither arguments, responses nor credentials enter this journal. */
export function createRPCTraceJournal(send: (event: RPCTrace) => void) {
  let enabled = false
  const events: RPCTrace[] = []
  const requests = new Map<string, RequestTrace>()
  function emit(requestId: string, phase: RPCTrace['phase']) {
    const request = requests.get(requestId)
    if (!enabled || !request) return
    const { started, ...identity } = request
    const event: RPCTrace = {
      ...identity,
      type: 'rpc_trace',
      eventId: randomUUID(),
      phase,
      timestamp: Date.now(),
      elapsedMs: Math.max(0, performance.now() - started)
    }
    events.push(event)
    if (events.length > MAX_TRACE_EVENTS) events.shift()
    // Diagnostics must never determine whether the actual request succeeds.
    try {
      send(event)
    } catch {
      console.warn('[MCP diagnostics] Metadata delivery deferred until reconnection')
    }
  }
  return {
    configure(value: boolean) {
      enabled = value
      if (!enabled) {
        events.length = 0
        requests.clear()
        return
      }
      for (const event of events) {
        try {
          send(event)
        } catch {
          console.warn('[MCP diagnostics] Could not replay request metadata')
          break
        }
      }
    },
    begin(requestId: string, body: Record<string, unknown>) {
      if (!enabled || requests.has(requestId)) return
      requests.set(requestId, {
        requestId,
        ...rpcTraceIdentity(body),
        started: performance.now()
      })
      if (requests.size > MAX_RECENT_REQUESTS) {
        const oldest = requests.keys().next().value
        if (oldest) requests.delete(oldest)
      }
      emit(requestId, 'received')
    },
    progress(requestId: string, stage: RPCStage, timestamp: number) {
      const request = requests.get(requestId)
      if (!request) return
      request.appStage = stage
      request.appTimestamp = timestamp
      emit(requestId, 'progress')
    },
    timeoutMessage(requestId: string, timeoutMs: number) {
      const stage = requests.get(requestId)?.appStage
      return `RPC timeout (${Math.round(timeoutMs / 1000)}s); request ${requestId}; last app stage: ${stage ?? (enabled ? 'no acknowledgement' : 'tracing disabled')}`
    },
    emit,
    clear() {
      events.length = 0
      requests.clear()
      enabled = false
    }
  }
}
