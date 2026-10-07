import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { createLiveFontUpdate } from '#tests/helpers/fonts/live-updates'
import { trackFontModuleResources } from '#tests/helpers/fonts/runtime'

test('AI edits keep the existing design visible while new fonts load', async ({ page }) => {
  await trackFontModuleResources(page)
  await page.goto('/?test&no-chrome&no-rulers')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  const update = await createLiveFontUpdate(page)
  try {
    await canvas.waitForRender()
    await update.evaluate((pending) => pending.start())
    await canvas.waitForRender()
    expect(await update.evaluate((pending) => pending.blocked())).toBe(false)
    expect(await canvas.screenshotCanvasRegion(700, 360)).toMatchSnapshot('pending-tool-fonts.png')
    await update.evaluate((pending) => pending.finish())
    await canvas.waitForRender()
    expect(await canvas.screenshotCanvasRegion(700, 360)).toMatchSnapshot('resolved-tool-fonts.png')
    canvas.assertNoErrors()
  } finally {
    await update.evaluate((pending) => pending.dispose())
    await update.dispose()
  }
})
