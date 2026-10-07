import * as v from 'valibot'

import { MCPStartupError } from '@/app/automation/mcp/failure'

const MCP_READY_TIMEOUT_MS = 30_000
const statusSchema = v.object({
  sessionId: v.string(),
  servers: v.array(v.object({ name: v.string(), status: v.string() }))
})

export function createKiroCanvasReadiness(enabled: boolean) {
  const statuses = new Map<string, string>()
  const listeners = new Set<() => void>()

  function observe(params: unknown) {
    if (!enabled) return
    const result = v.safeParse(statusSchema, params)
    if (!result.success) return
    const server = result.output.servers.find((entry) => entry.name === 'open-pencil')
    if (!server) return
    statuses.set(result.output.sessionId, server.status)
    for (const listener of listeners) listener()
  }

  async function wait(sessionId: string, signal: AbortSignal) {
    if (!enabled) return
    signal.throwIfAborted()
    await new Promise<void>((resolve, reject) => {
      function finish(error?: Error) {
        clearTimeout(timer)
        listeners.delete(check)
        signal.removeEventListener('abort', cancel)
        if (error) reject(error)
        else resolve()
      }
      function cancel() {
        finish(new Error('Agent connection was closed.'))
      }
      function check() {
        const status = statuses.get(sessionId)
        if (status === 'connected') finish()
        else if (status && status !== 'connecting') {
          finish(
            new MCPStartupError('Kiro could not connect to the canvas tools.', {
              code: 'unreachable'
            })
          )
        }
      }
      const timer = setTimeout(
        () =>
          finish(
            new MCPStartupError('Kiro canvas tools did not become ready in time.', {
              code: 'timeout'
            })
          ),
        MCP_READY_TIMEOUT_MS
      )
      listeners.add(check)
      signal.addEventListener('abort', cancel, { once: true })
      check()
    })
  }

  return { observe, wait }
}
