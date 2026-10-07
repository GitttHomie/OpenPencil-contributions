import { expect, test } from '@playwright/test'

import { createVariantLayoutScene } from '#tests/helpers/components/variant-layout'
import { propertySection } from '#tests/helpers/properties'

test('switching variant size reflows siblings and the Hug parent through undo and redo', async ({
  page
}) => {
  const scene = await createVariantLayoutScene(page)
  const small = {
    parent: { x: 60, y: 100, width: 188, height: 48 },
    first: { x: 8, y: 8, width: 80, height: 32 },
    second: { x: 100, y: 8, width: 80, height: 32 }
  }
  const large = {
    parent: { x: 60, y: 100, width: 268, height: 80 },
    first: { x: 8, y: 8, width: 160, height: 64 },
    second: { x: 180, y: 8, width: 80, height: 32 }
  }
  const size = propertySection(page, 'Variants').getByRole('combobox', { name: 'Size' })
  await expect.poll(scene.read).toEqual(small)
  await size.click()
  await page.getByRole('option', { name: 'Large', exact: true }).click()
  await expect.poll(scene.read).toEqual(large)
  await scene.canvas.waitForRender()
  expect(await scene.canvas.screenshotCanvasRegion(500, 260)).toMatchSnapshot(
    'large-variant-layout.png'
  )

  await scene.canvas.pressKey('Meta+z')
  await expect.poll(scene.read).toEqual(small)
  await scene.canvas.pressKey('Meta+Shift+z')
  await expect.poll(scene.read).toEqual(large)

  await size.click()
  await page.getByRole('option', { name: 'Small', exact: true }).click()
  await expect.poll(scene.read).toEqual(small)
  await scene.canvas.waitForRender()
  expect(await scene.canvas.screenshotCanvasRegion(500, 260)).toMatchSnapshot(
    'small-variant-layout.png'
  )
})
