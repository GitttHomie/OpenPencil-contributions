import { rpcTraceIdentity, type RPCStage, type RPCTrace } from '@open-pencil/mcp/diagnostics'

import type { CanvasSessionLogger } from '@/app/ai/acp/canvas/session'
import type { DiagnosticAttributes } from '@/app/diagnostics/types'

const MAX_REQUESTS = 256
const MAX_SEEN_EVENTS = 512

type RequestIdentity = ReturnType<typeof rpcTraceIdentity>
type TraceRecord = {
  timestamp: number
  attributes: DiagnosticAttributes
  failed: boolean
}
type RequestState = {
  identity: RequestIdentity
  logger?: CanvasSessionLogger
  started: number
}

/** Correlates helper and app clocks without storing tool arguments or document content. */
export function createRequestTrace({
  enabled,
  context,
  logger,
  write,
  now = Date.now,
  monotonic = () => performance.now()
}: {
  enabled: () => boolean
  context: () => DiagnosticAttributes
  logger: (id?: string) => CanvasSessionLogger | undefined
  write: (record: TraceRecord) => void
  now?: () => number
  monotonic?: () => number
}) {
  const requests = new Map<string, RequestState>()
  const pending = new Set<string>()
  const seen = new Set<string>()
  function request(id: string, identity: RequestIdentity, captureLogger = true) {
    let state = requests.get(id)
    if (!state) {
      state = {
        identity,
        logger: captureLogger ? logger(identity.managedChatId) : undefined,
        started: monotonic()
      }
      requests.set(id, state)
      if (requests.size > MAX_REQUESTS) {
        const oldest = requests.keys().next().value
        if (oldest) {
          requests.delete(oldest)
          pending.delete(oldest)
        }
      }
    }
    return state
  }
  function record(
    id: string,
    state: RequestState,
    timestamp: number,
    attributes: DiagnosticAttributes,
    failed = false
  ) {
    if (!enabled()) return
    try {
      const fields = {
        ...context(),
        requestId: id,
        command: state.identity.command,
        tool: state.identity.tool ?? null,
        managedChatId: state.identity.managedChatId ?? null,
        pendingRequests: pending.size,
        ...attributes
      }
      write({ timestamp, attributes: fields, failed })
      state.logger?.('mcp.request', { timestamp, ...fields })
    } catch {
      console.warn('[MCP diagnostics] Could not record request metadata')
    }
  }
  return {
    start(id: string, identity: RequestIdentity) {
      if (!enabled()) return
      pending.add(id)
      // The state may already exist from helper.received, with its original turn's logger.
      request(id, identity).started = monotonic()
    },
    stage(id: string, stage: RPCStage) {
      const state = requests.get(id)
      if (state)
        record(
          id,
          state,
          now(),
          { origin: 'app', phase: stage, elapsedMs: Math.max(0, monotonic() - state.started) },
          stage === 'failed'
        )
    },
    finish(id: string) {
      pending.delete(id)
    },
    helper(event: RPCTrace) {
      if (!enabled() || seen.has(event.eventId)) return
      seen.add(event.eventId)
      if (seen.size > MAX_SEEN_EVENTS) {
        const oldest = seen.values().next().value
        if (oldest) seen.delete(oldest)
      }
      const state = request(
        event.requestId,
        rpcTraceIdentity({
          command: event.command,
          args: { name: event.tool },
          managedChatId: event.managedChatId
        }),
        event.phase === 'received'
      )
      record(
        event.requestId,
        state,
        event.timestamp,
        {
          origin: 'helper',
          phase: event.phase,
          elapsedMs: event.elapsedMs,
          appStage: event.appStage ?? null,
          appTimestamp: event.appTimestamp ?? null,
          deliveredAt: now()
        },
        ['failed', 'timeout', 'disconnected'].includes(event.phase)
      )
    },
    get pendingCount() {
      return pending.size
    },
    clear() {
      requests.clear()
      pending.clear()
      seen.clear()
    }
  }
}
