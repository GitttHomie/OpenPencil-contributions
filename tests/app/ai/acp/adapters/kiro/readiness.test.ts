import { expect, test } from 'bun:test'

import { createKiroCanvasReadiness } from '@/app/ai/acp/adapters/kiro/readiness'
import { MCPStartupError } from '@/app/automation/mcp/failure'

test('waits for this session’s canvas tools and ignores other server status', async () => {
  const readiness = createKiroCanvasReadiness(true)
  let ready = false
  const waiting = readiness.wait('current', new AbortController().signal).then(() => {
    ready = true
    return undefined
  })
  readiness.observe({ sessionId: 'other', servers: [{ name: 'open-pencil', status: 'connected' }] })
  readiness.observe({ sessionId: 'current', servers: [{ name: 'external', status: 'connected' }] })
  await Promise.resolve()
  expect(ready).toBe(false)
  readiness.observe({
    sessionId: 'current',
    servers: [{ name: 'open-pencil', status: 'connected' }]
  })
  await waiting
  expect(ready).toBe(true)
})

test('startup failure gives an actionable canvas error and cancellation stops waiting', async () => {
  const failed = createKiroCanvasReadiness(true)
  failed.observe({ sessionId: 'session', servers: [{ name: 'open-pencil', status: 'failed' }] })
  await expect(failed.wait('session', new AbortController().signal)).rejects.toBeInstanceOf(
    MCPStartupError
  )
  const cancelled = createKiroCanvasReadiness(true)
  const abort = new AbortController()
  const waiting = cancelled.wait('session', abort.signal)
  abort.abort()
  await expect(waiting).rejects.toThrow('Agent connection was closed')
})

test('metadata discovery and other adapters do not wait for Kiro notifications', async () => {
  await createKiroCanvasReadiness(false).wait('session', new AbortController().signal)
})
