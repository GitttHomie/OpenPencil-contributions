type ClockSample = { monotonic: number; wall: number }

/** Report both clocks: a scheduling delay, sleep and a wall-clock adjustment differ. */
export function schedulingGap(previous: ClockSample, next: ClockSample, intervalMs: number) {
  const monotonicGapMs = next.monotonic - previous.monotonic
  const wallGapMs = next.wall - previous.wall
  return {
    delayMs: Math.max(0, Math.max(monotonicGapMs, wallGapMs) - intervalMs),
    wallGapMs,
    monotonicGapMs
  }
}
