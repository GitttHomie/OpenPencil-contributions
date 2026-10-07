import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import {
  installScreenSampler,
  samplePaint,
  seedSamplePaint
} from '#tests/helpers/color-picker/eyedropper'
import { propertyItems } from '#tests/helpers/properties'

for (const kind of ['fill', 'stroke', 'gradient'] as const) {
  test(`${kind}: screen sampling changes RGB, preserves alpha, and can be undone`, async ({
    page
  }) => {
    await installScreenSampler(page, 'color')
    await page.goto('/?test&no-rulers')
    const canvas = new CanvasHelper(page)
    await canvas.waitForInit()
    const id = await seedSamplePaint(page, kind)
    const before = await samplePaint(page, id, kind)
    if (kind === 'stroke')
      await propertyItems(page, 'strokes')
        .first()
        .getByRole('button', { name: 'Stroke', exact: true })
        .click()
    else await page.getByTestId('fill-picker-swatch').first().click()
    await page.getByRole('button', { name: 'Pick color from screen', exact: true }).click()
    await expect
      .poll(() => samplePaint(page, id, kind))
      .toMatchObject({ color: { r: 18 / 255, g: 171 / 255, b: 52 / 255, a: 0.4 } })
    await page.getByRole('heading', { name: 'Position', exact: true }).click()
    await canvas.pressKey('Meta+z')
    await expect.poll(() => samplePaint(page, id, kind)).toEqual(before)
    canvas.assertNoErrors()
  })
}

for (const result of ['cancel', 'unsupported'] as const) {
  test(`${result}: the eyedropper leaves the color unchanged`, async ({ page }) => {
    await installScreenSampler(page, result)
    await page.goto('/?test&no-rulers')
    const canvas = new CanvasHelper(page)
    await canvas.waitForInit()
    const id = await seedSamplePaint(page, 'fill')
    const before = await samplePaint(page, id, 'fill')
    await page.getByTestId('fill-picker-swatch').first().click()
    const button = page.getByRole('button', { name: 'Pick color from screen', exact: true })
    if (result === 'unsupported') await expect(button).toBeDisabled()
    else {
      await button.click()
      await expect(button).toBeEnabled()
    }
    expect(await samplePaint(page, id, 'fill')).toEqual(before)
    canvas.assertNoErrors()
  })
}

test('a late screen sample cannot change a different selection', async ({ page }) => {
  await installScreenSampler(page, 'deferred')
  await page.goto('/?test&no-rulers')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  const id = await seedSamplePaint(page, 'fill')
  const before = await samplePaint(page, id, 'fill')
  await page.getByTestId('fill-picker-swatch').first().click()
  const button = page.getByRole('button', { name: 'Pick color from screen', exact: true })
  await button.click()
  await expect(button).toBeDisabled()
  await page.evaluate(() => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Missing editor')
    editor.clearSelection()
    window.dispatchEvent(new Event('test:sample-color'))
  })
  await expect(button).toHaveCount(0)
  expect(await samplePaint(page, id, 'fill')).toEqual(before)
  canvas.assertNoErrors()
})
