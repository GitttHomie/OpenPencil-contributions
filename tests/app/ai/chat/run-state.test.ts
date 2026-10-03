import { expect, test } from 'bun:test'

import { createChatRunState } from '@/app/ai/chat/run-state'

test('only a confirmed final stop marks the whole run finished', () => {
  const run = createChatRunState()
  expect(run.state.value).toBeNull()
  run.start()
  expect(run.state.value?.phase).toBe('working')
  run.finish({ finishReason: 'stop', isAbort: false, isDisconnect: false, isError: false })
  expect(run.state.value?.phase).toBe('finished')
  expect(run.state.value?.endedAt).toBeGreaterThanOrEqual(run.state.value?.startedAt ?? 0)
  run.start()
  expect(run.state.value?.phase).toBe('working')
  expect(run.state.value?.endedAt).toBeUndefined()
})

test('aborts, errors, disconnects and limits never look successfully finished', () => {
  for (const [event, phase] of [
    [{ isAbort: true, isError: false, isDisconnect: false, finishReason: 'stop' }, 'stopped'],
    [{ isAbort: false, isError: true, isDisconnect: false }, 'failed'],
    [{ isAbort: false, isError: false, isDisconnect: true }, 'interrupted'],
    [{ isAbort: false, isError: false, isDisconnect: false }, 'interrupted'],
    [{ isAbort: false, isError: false, isDisconnect: false, finishReason: 'length' }, 'limited'],
    [{ isAbort: false, isError: false, isDisconnect: false, finishReason: 'tool-calls' }, 'limited']
  ] as const) {
    const run = createChatRunState()
    run.start()
    run.finish(event)
    expect(run.state.value?.phase).toBe(phase)
  }
})

test('a later stream completion cannot overwrite a provider error', () => {
  const run = createChatRunState()
  run.start()
  run.fail()
  run.finish({ finishReason: 'stop', isAbort: false, isDisconnect: false, isError: false })
  expect(run.state.value?.phase).toBe('failed')
})
