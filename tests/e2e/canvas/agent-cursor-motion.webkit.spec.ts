import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { createAgentCursorMotionProbe } from '#tests/helpers/canvas/agent-cursor-motion'

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`agent cursor movement respects ${reducedMotion}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion })
    await page.goto('/?test&no-chrome&no-rulers')
    const canvas = new CanvasHelper(page)
    await canvas.waitForInit()
    const probe = await createAgentCursorMotionProbe(page)
    try {
      await probe.evaluate((cursor) => cursor.move(100))
      await expect.poll(() => probe.evaluate((cursor) => cursor.snapshot().latest)).toBe(100)
      await probe.evaluate((cursor) => {
        cursor.reset()
        cursor.move(500)
      })
      expect(await probe.evaluate((cursor) => cursor.snapshot().target)).toBe(500)
      await expect.poll(() => probe.evaluate((cursor) => cursor.snapshot().latest)).toBe(500)
      const result = await probe.evaluate((cursor) => cursor.snapshot())
      const intermediate = result.positions.filter((x) => x > 100 && x < 500)
      if (reducedMotion === 'reduce') {
        expect(intermediate).toEqual([])
      } else {
        expect(new Set(intermediate).size).toBeGreaterThan(1)
        // Animation itself must not redraw either canvas surface.
        expect(result.overlayFrames).toBeLessThan(result.positions.length)
        expect(result.overlayFrames).toBeLessThanOrEqual(3)
        expect(result.sceneFrames).toBeLessThanOrEqual(2)
      }
      expect(result.duplicatePointer).toBe(false)
      canvas.assertNoErrors()
    } finally {
      await probe.evaluate((cursor) => cursor.dispose())
      await probe.dispose()
    }
  })
}

test('agent glide takes the latest target, keeps its size through zoom, and disappears on idle', async ({
  page
}) => {
  await page.goto('/?test&no-chrome&no-rulers')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  const probe = await createAgentCursorMotionProbe(page)
  try {
    await probe.evaluate((cursor) => cursor.move(100))
    await expect.poll(() => probe.evaluate((cursor) => cursor.snapshot().latest)).toBe(100)
    const width = (await probe.evaluate((cursor) => cursor.snapshot())).arrowWidth
    await probe.evaluate((cursor) => {
      cursor.move(700)
      cursor.move(250)
      cursor.move(400)
    })
    await expect.poll(() => probe.evaluate((cursor) => cursor.snapshot().latest)).toBe(400)
    await probe.evaluate((cursor) => cursor.camera())
    await expect.poll(() => probe.evaluate((cursor) => cursor.snapshot().arrowWidth)).toBe(width)
    await expect.poll(() => probe.evaluate((cursor) => cursor.snapshot().screenX)).toBe(840)
    await probe.evaluate((cursor) => cursor.hide())
    await expect(page.getByTestId('agent-cursors')).toBeHidden()
    await probe.evaluate((cursor) => cursor.move(200))
    await expect.poll(() => probe.evaluate((cursor) => cursor.snapshot().latest)).toBe(200)
    canvas.assertNoErrors()
  } finally {
    await probe.evaluate((cursor) => cursor.dispose())
    await probe.dispose()
  }
})

test('agent pointer and selected-node outline are rendered once', async ({ page }) => {
  await page.goto('/?test&no-chrome&no-rulers')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  const probe = await createAgentCursorMotionProbe(page)
  try {
    await probe.evaluate((cursor) => {
      cursor.move(280)
      cursor.select()
    })
    await expect.poll(() => probe.evaluate((cursor) => cursor.snapshot().latest)).toBe(280)
    expect(await canvas.screenshotCanvasRegion(440, 280)).toMatchSnapshot('agent-pointer.png')
    expect((await probe.evaluate((cursor) => cursor.snapshot())).duplicatePointer).toBe(false)
    canvas.assertNoErrors()
  } finally {
    await probe.evaluate((cursor) => cursor.dispose())
    await probe.dispose()
  }
})

test('agent pointer continues moving while the UI thread is busy', async ({
  page,
  browserName
}) => {
  test.skip(browserName !== 'chromium', 'Compositor frame capture requires Chromium CDP')
  await page.goto('/?test&no-chrome&no-rulers')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  const probe = await createAgentCursorMotionProbe(page)
  const session = await page.context().newCDPSession(page)
  const frames: { timestamp: number; data: string }[] = []
  const acknowledgements: Promise<unknown>[] = []
  session.on(
    'Page.screencastFrame',
    (event: { metadata: { timestamp?: number }; data: string; sessionId: number }) => {
      if (event.metadata.timestamp) {
        frames.push({ timestamp: event.metadata.timestamp * 1000, data: event.data })
      }
      acknowledgements.push(session.send('Page.screencastFrameAck', { sessionId: event.sessionId }))
    }
  )
  try {
    await probe.evaluate((cursor) => cursor.move(100))
    await expect.poll(() => probe.evaluate((cursor) => cursor.snapshot().latest)).toBe(100)
    await session.send('Page.startScreencast', { format: 'png', maxWidth: 640, maxHeight: 480 })
    await probe.evaluate((cursor) => cursor.move(500))
    await expect
      .poll(() => probe.evaluate((cursor) => cursor.snapshot().latest), { intervals: [16] })
      .toBeGreaterThan(100)
    await probe.evaluate((cursor) => cursor.busy())
    await expect
      .poll(() => probe.evaluate((cursor) => cursor.snapshot().busyInterval.end))
      .toBeGreaterThan(0)
    await session.send('Page.stopScreencast')
    const { busyInterval } = await probe.evaluate((cursor) => cursor.snapshot())
    // This scene is static except for the agent pointer. Distinct compositor images
    // inside the blocked interval prove movement without Vue/rAF/canvas work.
    const duringWork = frames.filter(
      (frame) =>
        frame.timestamp > busyInterval.start + 30 && frame.timestamp < busyInterval.end - 30
    )
    expect(new Set(duringWork.map((frame) => frame.data)).size).toBeGreaterThan(1)
    canvas.assertNoErrors()
  } finally {
    await Promise.all(acknowledgements)
    await session.detach()
    await probe.evaluate((cursor) => cursor.dispose())
    await probe.dispose()
  }
})
