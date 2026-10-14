import { afterEach, expect, test, vi } from 'bun:test'

import { LocalMCPTransport } from '@/app/integrations/mcp/local-transport'

import { clearTauriMocks, mockTauriIPC } from '#tests/helpers/tauri/mocks'

afterEach(clearTauriMocks)

test('native stdio preserves split protocol messages and closes exactly once', async () => {
  let emit: ((event: unknown) => void) | undefined
  const writes: unknown[] = []
  const kills: unknown[] = []
  await mockTauriIPC((command, args) => {
    if (command === 'mcp_process_spawn') {
      expect(args).toMatchObject({ command: '/tmp/Example MCP', args: ['a b'], env: {} })
      emit = (args as { events: { onmessage: (event: unknown) => void } }).events.onmessage
      return 99
    }
    if (command === 'agent_process_write') writes.push(args)
    if (command === 'agent_process_kill') kills.push(args)
    return null
  })
  const transport = new LocalMCPTransport({ command: '/tmp/Example MCP', args: ['a b'], env: {} })
  const messages = vi.fn()
  const closed = vi.fn()
  transport.onmessage = messages
  transport.onclose = closed
  await transport.start()
  const message = { jsonrpc: '2.0' as const, id: 1, result: { label: 'Żółć' } }
  const bytes = new TextEncoder().encode(`${JSON.stringify(message)}\n`)
  for (const byte of bytes) emit?.({ event: 'stdout', data: [byte] })
  emit?.({ event: 'stderr', data: [1, 2, 3] })
  expect(messages).toHaveBeenCalledTimes(1)
  expect(messages).toHaveBeenCalledWith(message)
  await transport.send({ jsonrpc: '2.0', id: 2, method: 'tools/list' })
  expect(writes).toEqual([
    {
      pid: 99,
      data: Array.from(new TextEncoder().encode('{"jsonrpc":"2.0","id":2,"method":"tools/list"}\n'))
    }
  ])
  await transport.close()
  emit?.({ event: 'close' })
  await transport.close()
  expect(closed).toHaveBeenCalledTimes(1)
  expect(kills).toEqual([{ pid: 99 }])
  await expect(transport.send(message)).rejects.toThrow('closed')
})

test('cancelling startup stops a process even when spawn resolves later', async () => {
  let finish: ((pid: number) => void) | undefined
  const kills: unknown[] = []
  await mockTauriIPC((command, args) => {
    if (command === 'mcp_process_spawn')
      return new Promise<number>((resolve) => {
        finish = resolve
      })
    if (command === 'agent_process_kill') kills.push(args)
    return null
  })
  const transport = new LocalMCPTransport({ command: 'test-server', args: [], env: {} })
  const start = transport.start()
  await transport.close()
  finish?.(100)
  await start
  expect(kills).toEqual([{ pid: 100 }])
})
