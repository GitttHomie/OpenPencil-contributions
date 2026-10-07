import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { renderCSSLayout } from '#tests/helpers/canvas/css-layout'

test('render draws equal Fill labels, repeat grid tracks, and a CSS shadow list', async ({
  page
}) => {
  await page.goto('/?test&no-chrome&no-rulers')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  const labels = await renderCSSLayout(page)
  const share = (280 - 6 * 4) / 7
  for (const [index, label] of labels.entries()) {
    expect(label.width).toBeCloseTo(share, 3)
    expect(label.x).toBeCloseTo(index * (share + 4), 3)
  }
  expect(await canvas.screenshotCanvasRegion(460, 320)).toMatchSnapshot('css-calendar.png')
  canvas.assertNoErrors()
})
