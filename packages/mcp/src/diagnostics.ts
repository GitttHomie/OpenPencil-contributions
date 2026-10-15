import * as v from 'valibot'

const identifier = v.pipe(v.string(), v.maxLength(100))
const timestamp = v.pipe(v.number(), v.finite(), v.minValue(0))
export const RPCStage = v.picklist([
  'received',
  'preparing',
  'queued',
  'executing',
  'completed',
  'responding',
  'failed'
])
export type RPCStage = v.InferOutput<typeof RPCStage>
export const RPCProgress = v.object({
  type: v.literal('progress'),
  id: identifier,
  stage: RPCStage,
  timestamp
})
export const RPCTraceConfig = v.object({ type: v.literal('trace_config'), enabled: v.boolean() })
export const RPCTrace = v.object({
  type: v.literal('rpc_trace'),
  eventId: identifier,
  requestId: identifier,
  phase: v.picklist([
    'received',
    'sent',
    'progress',
    'completed',
    'failed',
    'timeout',
    'disconnected',
    'late-response'
  ]),
  timestamp,
  elapsedMs: timestamp,
  command: identifier,
  tool: v.optional(identifier),
  managedChatId: v.optional(identifier),
  appStage: v.optional(RPCStage),
  appTimestamp: v.optional(timestamp)
})
export type RPCTrace = v.InferOutput<typeof RPCTrace>

function name(value: unknown): string | undefined {
  return typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,100}$/.test(value) ? value : undefined
}

/** Only protocol identifiers cross into diagnostics, never arbitrary arguments. */
export function rpcTraceIdentity(body: {
  command?: unknown
  args?: unknown
  managedChatId?: unknown
}) {
  const args = body.args
  return {
    command: name(body.command) ?? 'unknown',
    tool: args && typeof args === 'object' && 'name' in args ? name(args.name) : undefined,
    managedChatId: name(body.managedChatId)
  }
}
