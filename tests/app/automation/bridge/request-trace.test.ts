import { expect, test } from 'bun:test'

import { rpcTraceIdentity, type RPCTrace } from '@open-pencil/mcp/diagnostics'

import { createRequestTrace } from '@/app/automation/bridge/request-trace'
import type { DiagnosticAttributes } from '@/app/diagnostics/types'

test('parallel requests retain their original run logger and correlate late helper responses', () => {
  const written: DiagnosticAttributes[] = []
  const first: unknown[] = []
  const second: unknown[] = []
  let active = first
  let time = 100
  const trace = createRequestTrace({
    enabled: () => true,
    context: () => ({ visibility: 'visible' }),
    logger: () => {
      const run = active
      return (_type, data) => {
        run.push(data)
      }
    },
    write: (record) => written.push(record.attributes),
    now: () => time,
    monotonic: () => time
  })
  trace.start('one', { command: 'tool', tool: 'render', managedChatId: 'chat' })
  trace.stage('one', 'executing')
  active = second
  trace.start('two', { command: 'tool', tool: 'describe', managedChatId: 'chat' })
  trace.stage('two', 'executing')
  time = 150
  trace.finish('one')
  const event: RPCTrace = {
    type: 'rpc_trace',
    eventId: 'late-one',
    requestId: 'one',
    command: 'tool',
    tool: 'render',
    managedChatId: 'chat',
    phase: 'late-response',
    timestamp: 140,
    elapsedMs: 40
  }
  trace.helper(event)
  trace.helper(event)
  expect(first).toHaveLength(2)
  expect(second).toHaveLength(1)
  expect(written.at(-1)).toMatchObject({
    requestId: 'one',
    phase: 'late-response',
    deliveredAt: 150,
    pendingRequests: 1
  })
  trace.finish('two')
  expect(trace.pendingCount).toBe(0)
})

test('disabled tracing stores nothing and failing diagnostics cannot interrupt execution', () => {
  let enabled = false
  const written: unknown[] = []
  const trace = createRequestTrace({
    enabled: () => enabled,
    context: () => {
      throw new Error('Closed document')
    },
    logger: () => undefined,
    write: (record) => written.push(record)
  })
  trace.start('disabled', rpcTraceIdentity({ command: 'tool' }))
  expect(trace.pendingCount).toBe(0)
  enabled = true
  trace.start('one', rpcTraceIdentity({ command: 'tool' }))
  expect(() => trace.stage('one', 'executing')).not.toThrow()
  expect(written).toHaveLength(0)
  trace.clear()
  expect(trace.pendingCount).toBe(0)
})
