import { expect, test } from 'bun:test'

import type { RPCTrace } from '#mcp/diagnostics'
import { createRPCTraceJournal } from '#mcp/transport/rpc-trace'

test('RPC history records identifiers and the last acknowledged app stage, never payloads', () => {
  const events: RPCTrace[] = []
  const journal = createRPCTraceJournal((event) => events.push(event))
  journal.configure(true)
  journal.begin('one', {
    command: 'tool',
    managedChatId: 'chat-1',
    args: { name: 'render', args: { jsx: 'private-design', token: 'private-token' } }
  })
  journal.emit('one', 'sent')
  journal.progress('one', 'queued', 100)
  journal.emit('one', 'timeout')
  expect(events.map((event) => event.phase)).toEqual(['received', 'sent', 'progress', 'timeout'])
  expect(events.at(-1)).toMatchObject({
    requestId: 'one',
    tool: 'render',
    appStage: 'queued',
    appTimestamp: 100
  })
  expect(journal.timeoutMessage('one', 20_000)).toContain('last app stage: queued')
  expect(JSON.stringify(events)).not.toContain('private-')
})

test('RPC replay and request history are bounded, and opting out clears both', () => {
  const events: RPCTrace[] = []
  const journal = createRPCTraceJournal((event) => events.push(event))
  journal.configure(true)
  for (let i = 0; i < 300; i++) journal.begin(String(i), { command: 'selection' })
  events.length = 0
  journal.configure(true)
  expect(events).toHaveLength(256)
  journal.progress('0', 'executing', 200)
  expect(events).toHaveLength(256)
  journal.configure(false)
  journal.emit('299', 'timeout')
  journal.configure(true)
  expect(events).toHaveLength(256)
})

test('a disconnected diagnostic sink cannot fail a request', () => {
  const journal = createRPCTraceJournal(() => {
    throw new Error('Socket closed')
  })
  journal.configure(true)
  expect(() => journal.begin('one', { command: 'tool' })).not.toThrow()
  expect(() => journal.configure(true)).not.toThrow()
})
