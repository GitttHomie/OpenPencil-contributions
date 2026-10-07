import { afterEach, expect, test, vi } from 'bun:test'

import { spawnACPProcess } from '@/app/ai/acp/process'

import { clearTauriMocks, mockTauriIPC } from '#tests/helpers/tauri/mocks'

afterEach(async () => {
  await clearTauriMocks()
  vi.restoreAllMocks()
  Reflect.deleteProperty(globalThis, 'window')
  Reflect.deleteProperty(globalThis, 'navigator')
})

test('configured agents use the native launcher and retain bidirectional streaming and cleanup', async () => {
  let event: ((message: unknown) => void) | undefined
  const commands: string[] = []
  const closed = vi.fn()
  await mockTauriIPC((command, args) => {
    commands.push(command)
    if (command === 'agent_process_spawn') {
      expect(args).toMatchObject({
        command: 'codex-acp',
        args: ['-c', 'model_provider="team"'],
        env: {}
      })
      event = (args as { events: { onmessage: (message: unknown) => void } }).events.onmessage
      return 72
    }
    if (command === 'agent_process_write') expect(args).toEqual({ pid: 72, data: [4, 5] })
    if (command === 'agent_process_kill') expect(args).toEqual({ pid: 72 })
    return null
  })
  const process = await spawnACPProcess({
    command: 'codex-acp',
    args: ['-c', 'model_provider="team"'],
    logId: 'configured',
    destroying: () => false,
    onUnexpectedClose: closed
  })
  const reader = process.output.getReader()
  event?.({ event: 'stdout', data: [1, 2, 3] })
  await expect(reader.read()).resolves.toEqual({ done: false, value: new Uint8Array([1, 2, 3]) })
  await process.input.getWriter().write(new Uint8Array([4, 5]))
  event?.({ event: 'close' })
  await expect(reader.read()).rejects.toThrow('Agent process exited unexpectedly.')
  expect(closed).toHaveBeenCalledTimes(1)
  await process.child.kill()
  expect(commands).toEqual(['agent_process_spawn', 'agent_process_write', 'agent_process_kill'])
})

test('environment-only overrides also pass through native validation', async () => {
  await mockTauriIPC((command, args) => {
    expect(command).toBe('agent_process_spawn')
    expect(args).toMatchObject({
      command: 'claude-agent-acp',
      args: [],
      env: { AWS_REGION: 'us-east-1' }
    })
    return 73
  })
  await spawnACPProcess({
    command: 'claude-agent-acp',
    args: [],
    env: { AWS_REGION: 'us-east-1' },
    logId: 'region',
    destroying: () => true,
    onUnexpectedClose: vi.fn()
  })
})
