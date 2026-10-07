import { expect, test } from 'bun:test'

import { createChatTiming } from '@/app/ai/chat/timing'

test('timing separates stream readiness from first model output and counts calls once', () => {
  let now = 10
  const timing = createChatTiming(() => now)
  timing.start()
  now = 30
  timing.ready()
  timing.observe({ type: 'start' })
  expect(timing.snapshot().firstOutputMs).toBeNull()
  now = 110
  timing.observe({ type: 'reasoning-delta', id: 'reasoning', delta: 'Considering layout' })
  now = 300
  timing.observe({ type: 'tool-input-start', toolCallId: 'one', toolName: 'render' })
  timing.observe({ type: 'tool-input-available', toolCallId: 'one', toolName: 'render', input: {} })
  now = 510
  expect(timing.snapshot()).toEqual({
    durationMs: 500,
    firstOutputMs: 100,
    streamReadyMs: 20,
    toolCalls: 1,
    toolActivityMs: 210
  })
  timing.start()
  expect(timing.snapshot()).toEqual({
    durationMs: 0,
    firstOutputMs: null,
    streamReadyMs: null,
    toolCalls: 0,
    toolActivityMs: 0
  })
})

test('overlapping tool activity counts wall time once and stops after the last result', () => {
  let now = 0
  const timing = createChatTiming(() => now)
  timing.start()
  now = 5
  timing.observe({ type: 'tool-input-start', toolCallId: 'one', toolName: 'describe' })
  now = 7
  timing.observe({
    type: 'tool-input-available',
    toolCallId: 'two',
    toolName: 'get_selection',
    input: {}
  })
  now = 10
  timing.observe({ type: 'tool-output-available', toolCallId: 'one', output: {} })
  now = 15
  timing.observe({ type: 'tool-output-error', toolCallId: 'two', errorText: 'Cancelled' })
  now = 20
  expect(timing.snapshot()).toMatchObject({ toolCalls: 2, toolActivityMs: 10 })
})
