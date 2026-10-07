import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { saveAndReopenPropertyDocument } from '#tests/helpers/components/property-authoring'
import {
  readVariantPropertyScene,
  seedVariantPropertyScene,
  selectVariantPropertyNode
} from '#tests/helpers/components/variant-properties'
import { propertySection } from '#tests/helpers/properties'

test('descriptor values reorder, persist independently of components and require safe replacement on deletion', async ({
  page
}) => {
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await canvas.clearCanvas()
  await seedVariantPropertyScene(page, 2, false)
  const initial = await readVariantPropertyScene(page)
  const section = propertySection(page, 'Variants')
  const card = section.locator('[data-property]').first()
  await expect(section.getByRole('textbox')).toHaveCount(1)
  await expect(section.getByRole('button', { name: 'Delete variant', exact: true })).toHaveCount(0)
  await card.getByRole('textbox', { name: 'Property name', exact: true }).fill('State')
  await card.getByRole('textbox', { name: 'Property name', exact: true }).blur()
  await card.getByRole('button', { name: 'Variant properties: State', exact: true }).click()
  const values = card.locator('[data-variant-value]')
  await values.first().getByRole('textbox').fill('Base')
  await values.first().getByRole('textbox').blur()
  await values.last().getByRole('textbox').fill('Hover')
  await values.last().getByRole('textbox').blur()
  await card.getByRole('textbox', { name: 'Add value', exact: true }).fill('Pressed')
  await card.getByRole('button', { name: 'Add value', exact: true }).click()
  await expect(values).toHaveCount(3)
  const handles = card.locator('[data-reorder-handle]')
  await handles.last().dragTo(handles.first(), { targetPosition: { x: 12, y: 1 } })
  await expect(values.first().getByRole('textbox')).toHaveValue('Pressed')
  expect((await readVariantPropertyScene(page)).variants.map((node) => node.id)).toEqual(
    initial.variants.map((node) => node.id)
  )
  await section.screenshot({ path: test.info().outputPath('variant-descriptors.png') })
  await saveAndReopenPropertyDocument(page, test.info().outputPath('descriptors.fig'))
  const reopened = await readVariantPropertyScene(page)
  expect(reopened.properties[0].values).toEqual(['Pressed', 'Base', 'Hover'])
  if (!reopened.set) throw new Error('Missing set')
  await selectVariantPropertyNode(page, reopened.set.id)
  const toggle = card.getByRole('button', { name: 'Variant properties: State', exact: true })
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click()
  await card
    .locator('[data-variant-value="Hover"]')
    .getByRole('button', { name: 'Delete value', exact: true })
    .click()
  const removal = card.locator('[data-removing-value]')
  await removal.getByRole('combobox', { name: 'Replace with', exact: true }).click()
  await page.getByRole('option', { name: 'Base', exact: true }).click()
  await removal.getByRole('button', { name: 'Delete value', exact: true }).click()
  await expect(section.getByRole('alert').locator('[data-node-id]')).toHaveCount(2)
  await expect(values).toHaveCount(3)
  await removal.getByRole('combobox', { name: 'Replace with', exact: true }).click()
  await page.getByRole('option', { name: 'Pressed', exact: true }).click()
  await removal.getByRole('button', { name: 'Delete value', exact: true }).click()
  await expect(values).toHaveCount(2)
  await expect(section.getByRole('alert')).toHaveCount(0)
  const beforeDelete = await readVariantPropertyScene(page)
  expect(beforeDelete.variants.map((node) => node.name)).toEqual(['State=Base', 'State=Pressed'])
  await card.getByRole('button', { name: 'Remove variant property', exact: true }).click()
  await expect(section.locator('[data-property]')).toHaveCount(0)
  expect((await readVariantPropertyScene(page)).variants).toEqual(beforeDelete.variants)
  await canvas.pressKey('Meta+z')
  await expect(section.locator('[data-property]')).toHaveCount(1)
  canvas.assertNoErrors()
})

test('component attributes drag independently of variants and persist after reopening', async ({
  page
}) => {
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await canvas.clearCanvas()
  await seedVariantPropertyScene(page, 2)
  const section = propertySection(page, 'Component properties')
  // Create a second attribute through the same public editor action as the form.
  await page.evaluate(() => {
    const editor = window.openPencil?.getStore?.()
    const set = editor?.getSelectedNodes()[0]
    if (!editor || !set) throw new Error('Missing set')
    editor.createComponentProperty(set.id, 'Visible', 'BOOLEAN', 'true')
  })
  const names = section.getByRole('textbox', { name: 'Property name', exact: true })
  await expect(names).toHaveCount(2)
  await expect(names.first()).toHaveValue('Label')
  const before = await readVariantPropertyScene(page)
  const handles = section.locator('[data-reorder-handle]')
  await handles.last().dragTo(handles.first(), { targetPosition: { x: 12, y: 1 } })
  await expect(names.first()).toHaveValue('Visible')
  expect((await readVariantPropertyScene(page)).variants).toEqual(before.variants)
  await canvas.pressKey('Meta+z')
  await expect(names.first()).toHaveValue('Label')
  await handles.last().focus()
  await page.keyboard.press('ArrowUp')
  await expect(names.first()).toHaveValue('Visible')
  await saveAndReopenPropertyDocument(page, test.info().outputPath('attribute-order.fig'))
  const reopened = await readVariantPropertyScene(page)
  expect(
    reopened.properties
      .filter((property) => property.type !== 'VARIANT')
      .map((property) => property.name)
  ).toEqual(['Visible', 'Label'])
  canvas.assertNoErrors()
})
