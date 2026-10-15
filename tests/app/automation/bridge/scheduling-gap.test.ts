import { expect, test } from 'bun:test'

import { schedulingGap } from '@/app/automation/bridge/scheduling-gap'

test('distinguishes timely samples, blocked execution, and clocks that pause during sleep', () => {
  const initial = { monotonic: 1000, wall: 10_000 }
  expect(schedulingGap(initial, { monotonic: 2000, wall: 11_000 }, 1000).delayMs).toBe(0)
  expect(schedulingGap(initial, { monotonic: 4000, wall: 13_000 }, 1000)).toEqual({
    delayMs: 2000,
    wallGapMs: 3000,
    monotonicGapMs: 3000
  })
  expect(schedulingGap(initial, { monotonic: 2000, wall: 70_000 }, 1000)).toEqual({
    delayMs: 59_000,
    wallGapMs: 60_000,
    monotonicGapMs: 1000
  })
  // A backwards wall-clock adjustment must not hide an actual event-loop stall.
  expect(schedulingGap(initial, { monotonic: 4000, wall: 1000 }, 1000)).toEqual({
    delayMs: 2000,
    wallGapMs: -9000,
    monotonicGapMs: 3000
  })
})
