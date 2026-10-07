import { expect, test } from '@playwright/test'

import { createPropertyLayoutScene } from '#tests/helpers/components/property-authoring'
import { propertySection } from '#tests/helpers/properties'

test('typing exposed text resizes a Hug instance and its parent before blur', async ({ page }) => {
  const scene = await createPropertyLayoutScene(page)
  const exposure = propertySection(page, 'Expose as component property')
  await exposure.getByRole('button', { name: 'Text content: Expose', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Create property…', exact: true }).click()
  await exposure.getByRole('button', { name: 'Create', exact: true }).click()
  await scene.select(scene.ids.instance)
  const field = propertySection(page, 'Component properties').getByRole('textbox', {
    name: 'Caption',
    exact: true
  })
  const before = await scene.layout()
  await field.fill('Get your ticket')
  await expect(field).toBeFocused()
  await expect.poll(async () => (await scene.layout()).width).toBeGreaterThan(before.width)
  const grown = await scene.layout()
  expect(grown.sizing).toBe('HUG')
  expect(grown.sourceWidth).toBe(before.sourceWidth)
  expect(grown.siblingX).toBeCloseTo(grown.width + 12)
  expect(grown.rowWidth).toBeCloseTo(grown.width + 12 + grown.siblingWidth)
  await scene.canvas.waitForRender()
  expect(await scene.canvas.screenshotCanvasRegion(700, 240)).toMatchSnapshot(
    'exposed-text-hug.png'
  )
  await field.blur()
  await page.getByTestId('canvas-element').focus()
  await scene.canvas.undo()
  await expect.poll(scene.layout).toEqual(before)
  await scene.canvas.redo()
  await expect.poll(scene.layout).toEqual(grown)
  await field.fill('Hi')
  await expect(field).toBeFocused()
  await expect.poll(async () => (await scene.layout()).width).toBeLessThan(before.width)
})
