import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import {
  readNestedPropertyText,
  readNestedPropertyGeometry,
  seedNestedProperties,
  selectNestedPropertyInstance
} from '#tests/helpers/components/nested-properties'
import { saveAndReopenPropertyDocument } from '#tests/helpers/components/property-authoring'
import { propertySection } from '#tests/helpers/properties'

test('choose nested properties on a parent, edit them on an instance, and preserve them on reopen', async ({
  page
}, testInfo) => {
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await seedNestedProperties(page)
  const properties = propertySection(page, 'Component properties')
  await properties.getByRole('button', { name: 'Create property…', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Expose nested property', exact: true }).click()
  await expect(
    properties.getByRole('combobox', { name: 'Nested component', exact: true })
  ).toContainText('Action')
  await properties.getByRole('switch', { name: 'Expose Caption', exact: true }).check()
  await properties.getByRole('switch', { name: 'Expose Variant', exact: true }).check()
  await properties
    .getByRole('button', { name: 'Component properties: Caption', exact: true })
    .click()
  const parentDefault = properties.getByRole('textbox', { name: 'Default value', exact: true })
  await parentDefault.fill('Parent caption')
  await parentDefault.press('Enter')
  await properties
    .getByRole('button', { name: 'Component properties: Caption', exact: true })
    .click()
  const variantHandle = properties.getByRole('button', {
    name: 'Reorder Action / Variant',
    exact: true
  })
  const ownHandle = properties.getByRole('button', { name: 'Reorder Show action', exact: true })
  await variantHandle.dragTo(ownHandle, { targetPosition: { x: 12, y: 1 } })
  await expect(properties.locator('[data-reorder-handle]').first()).toHaveAccessibleName(
    'Reorder Action / Variant'
  )
  const preview = testInfo.outputPath('nested-property-authoring.png')
  await properties.screenshot({ path: preview })
  await testInfo.attach('nested-property-authoring', { path: preview, contentType: 'image/png' })
  await selectNestedPropertyInstance(page)
  const caption = properties.getByRole('textbox', { name: 'Action / Caption', exact: true })
  await expect(caption).toHaveValue('Parent caption')
  await expect(
    properties.getByRole('switch', { name: 'Action / Show caption', exact: true })
  ).toHaveCount(0)
  await caption.fill('Continue')
  await caption.blur()
  await expect.poll(() => readNestedPropertyText(page)).toBe('Continue')
  await page.getByTestId('canvas-element').focus()
  await saveAndReopenPropertyDocument(page, testInfo.outputPath('nested-properties.fig'))
  await selectNestedPropertyInstance(page)
  await expect(caption).toHaveValue('Continue')
  await caption.fill('Save')
  await caption.blur()
  await expect.poll(() => readNestedPropertyText(page)).toBe('Save')
  const variant = properties.getByRole('combobox', {
    name: 'Action / Variant',
    exact: true
  })
  await variant.click()
  await page.getByRole('option', { name: 'Variant 2', exact: true }).click()
  await expect(variant).toContainText('Variant 2')
  await expect.poll(() => readNestedPropertyGeometry(page)).toEqual({ width: 180, height: 64 })
  await expect(caption).toHaveValue('Save')
  canvas.assertNoErrors()
})

for (const direct of [false, true]) {
  test(`reopened nested size claims release through ${direct ? 'direct selection' : 'parent controls'}`, async ({
    page
  }, testInfo) => {
    await page.goto('/?test')
    const canvas = new CanvasHelper(page)
    await canvas.waitForInit()
    await seedNestedProperties(page, true)
    const properties = propertySection(page, 'Component properties')
    await properties.getByRole('button', { name: 'Create property…', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Expose nested property', exact: true }).click()
    await properties.getByRole('switch', { name: 'Expose Variant', exact: true }).check()
    await selectNestedPropertyInstance(page)
    await page.getByTestId('canvas-element').focus()
    await saveAndReopenPropertyDocument(page, testInfo.outputPath('saved-size-claims.fig'))
    await selectNestedPropertyInstance(page, direct)
    const variant = propertySection(page, direct ? 'Variants' : 'Component properties').getByRole(
      'combobox',
      {
        name: direct ? 'Variant' : 'Action / Variant',
        exact: true
      }
    )
    await variant.click()
    await page.getByRole('option', { name: 'Variant 2', exact: true }).click()
    await expect.poll(() => readNestedPropertyGeometry(page)).toEqual({ width: 180, height: 64 })
    await page.getByTestId('canvas-element').focus()
    await page.keyboard.press('Meta+z')
    await expect.poll(() => readNestedPropertyGeometry(page)).toEqual({ width: 120, height: 40 })
    await page.keyboard.press('Meta+Shift+z')
    await expect.poll(() => readNestedPropertyGeometry(page)).toEqual({ width: 180, height: 64 })
    await properties.screenshot({ path: testInfo.outputPath('nested-size-controls.png') })
    canvas.assertNoErrors()
  })
}
