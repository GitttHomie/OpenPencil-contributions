import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { createCanvasContextLossProbe } from '#tests/helpers/canvas/context-loss'

test('switching and closing tabs survives a lost cleanup GPU context', async ({ page }) => {
  test.setTimeout(60_000)
  const canvas = new CanvasHelper(page)
  await page.goto('/?test')
  await canvas.waitForInit()
  const probe = await createCanvasContextLossProbe(page)
  try {
    const first = await probe.evaluate((p) => p.activeTabId())
    const height = (await canvas.canvas.boundingBox())?.height
    expect(height).toBeGreaterThan(0)
    const second = await probe.evaluate((p) => p.createTab())
    await canvas.waitForInit()
    await expect(page.getByTestId('canvas-area')).toHaveCount(1)
    await expect.poll(() => probe.evaluate((p) => p.rendererCount())).toBe(2)

    await probe.evaluate((p, id) => p.switchTab(id), first)
    await canvas.waitForInit()
    await expect.poll(async () => (await canvas.canvas.boundingBox())?.height).toBe(height)
    await probe.evaluate((p, id) => p.switchTab(id), second)
    await canvas.waitForInit()
    await probe.evaluate((p) => p.closeActiveTab())
    await canvas.waitForInit()
    await probe.evaluate((p) => p.closeActiveTab())
    await expect(page.getByTestId('canvas-area')).toHaveCount(0)
    canvas.assertNoErrors()
  } finally {
    await probe.dispose()
  }
})
