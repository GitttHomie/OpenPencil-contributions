import type { UIMessageChunk } from 'ai'

/** Local durations only: no prompts, generated content, endpoints or credentials. */
export function createChatTiming(now: () => number = () => performance.now()) {
  let started = now()
  let firstOutputMs: number | null = null
  let streamReadyMs: number | null = null
  const calls = new Set<string>()
  const pending = new Set<string>()
  let toolsStarted = 0
  let toolActivityMs = 0
  const elapsed = () => Math.max(0, Math.round(now() - started))
  return {
    start() {
      started = now()
      firstOutputMs = null
      streamReadyMs = null
      calls.clear()
      pending.clear()
      toolActivityMs = 0
    },
    ready() {
      streamReadyMs = elapsed()
    },
    observe(chunk: UIMessageChunk) {
      if (
        chunk.type === 'text-delta' ||
        chunk.type === 'reasoning-delta' ||
        chunk.type === 'tool-input-start' ||
        chunk.type === 'tool-input-available'
      ) {
        firstOutputMs ??= elapsed()
      }
      if (chunk.type === 'tool-input-start' || chunk.type === 'tool-input-available') {
        if (!calls.has(chunk.toolCallId)) {
          if (!pending.size) toolsStarted = now()
          pending.add(chunk.toolCallId)
        }
        calls.add(chunk.toolCallId)
      }
      if (
        chunk.type === 'tool-output-available' ||
        chunk.type === 'tool-output-error' ||
        chunk.type === 'tool-output-denied' ||
        chunk.type === 'tool-input-error'
      ) {
        if (pending.delete(chunk.toolCallId) && !pending.size) {
          toolActivityMs += now() - toolsStarted
        }
      }
    },
    snapshot() {
      return {
        durationMs: elapsed(),
        firstOutputMs,
        streamReadyMs,
        toolCalls: calls.size,
        // Wall time while any reported tool is pending, including arguments and approvals.
        // Overlapping calls count once; this is not CPU execution time.
        toolActivityMs: Math.round(toolActivityMs + (pending.size ? now() - toolsStarted : 0))
      }
    }
  }
}
