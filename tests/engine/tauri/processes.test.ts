import { afterEach, describe, expect, test, vi } from 'bun:test'

import { spawnACPProcess } from '@/app/ai/acp/process'

import { clearTauriMocks, mockTauriIPC } from '#tests/helpers/tauri/mocks'

afterEach(async () => {
  await clearTauriMocks()
  vi.restoreAllMocks()
  Reflect.deleteProperty(globalThis, 'window')
  Reflect.deleteProperty(globalThis, 'navigator')
})

describe('Tauri process helpers', () => {
  test('spawns ACP processes and streams stdout/stdin through plugin-shell', async () => {
    let onEvent: ((event: unknown) => void) | null = null
    const calls: Array<{ cmd: string; args: unknown }> = []
    await mockTauriIPC((cmd, args) => {
      calls.push({ cmd, args })
      if (cmd === 'agent_lookup') return { executables: {}, searchPath: '/test/bin' }
      if (cmd === 'plugin:shell|spawn') {
        expect(args).toMatchObject({
          program: 'codex-acp',
          args: [],
          options: { encoding: 'raw', env: { PATH: '/test/bin' } }
        })
        onEvent = (args as { onEvent: { onmessage: (event: unknown) => void } }).onEvent.onmessage
        return 42
      }
      return null
    })

    const process = await spawnACPProcess({
      command: 'codex-acp',
      args: [],
      logId: 'test',
      destroying: () => false,
      onUnexpectedClose: vi.fn()
    })

    const reader = process.output.getReader()
    onEvent?.({ event: 'Stdout', payload: [1, 2, 3] })
    await expect(reader.read()).resolves.toEqual({ done: false, value: new Uint8Array([1, 2, 3]) })

    const writer = process.input.getWriter()
    await writer.write(new Uint8Array([4, 5]))
    await process.child.kill()

    expect(calls.map((call) => call.cmd)).toEqual([
      'agent_lookup',
      'plugin:shell|spawn',
      'plugin:shell|stdin_write',
      'plugin:shell|kill'
    ])
    expect(calls[2]?.args).toEqual({ pid: 42, buffer: [4, 5] })
    expect(calls[3]?.args).toEqual({ cmd: 'killChild', pid: 42 })
  })

  test('starts Windows ACP command shims through their cmd scope entry', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    })
    await mockTauriIPC((cmd, args) => {
      if (cmd === 'agent_lookup') return { executables: {}, searchPath: 'C:\\test\\bin' }
      if (cmd === 'plugin:shell|spawn') {
        expect(args).toMatchObject({
          program: 'cmd-codex-acp',
          args: ['/c', 'codex-acp'],
          options: { encoding: 'raw', env: { PATH: 'C:\\test\\bin' } }
        })
        return 44
      }
      return null
    })

    const process = await spawnACPProcess({
      command: 'codex-acp',
      args: [],
      logId: 'test',
      destroying: () => false,
      onUnexpectedClose: vi.fn()
    })
    await process.child.kill()
  })

  test('signals unexpected ACP process close to the output stream', async () => {
    let onEvent: ((event: unknown) => void) | null = null
    const onUnexpectedClose = vi.fn()
    await mockTauriIPC((cmd, args) => {
      if (cmd === 'agent_lookup') return { executables: {}, searchPath: '/test/bin' }
      if (cmd === 'plugin:shell|spawn') {
        onEvent = (args as { onEvent: { onmessage: (event: unknown) => void } }).onEvent.onmessage
        return 43
      }
      return null
    })

    const process = await spawnACPProcess({
      command: 'codex-acp',
      args: [],
      logId: 'test',
      destroying: () => false,
      onUnexpectedClose
    })
    const reader = process.output.getReader()

    onEvent?.({ event: 'Terminated', payload: { code: 1, signal: null } })

    await expect(reader.read()).rejects.toThrow('Agent process exited unexpectedly.')
    expect(onUnexpectedClose).toHaveBeenCalled()
  })
})
