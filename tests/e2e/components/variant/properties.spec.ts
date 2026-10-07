import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { saveAndReopenPropertyDocument } from '#tests/helpers/components/property-authoring'
import {
  readVariantPropertyScene,
  seedVariantPropertyScene,
  selectVariantPropertyNode
} from '#tests/helpers/components/variant-properties'
import { propertySection } from '#tests/helpers/properties'

test('instance variant selectors remain available when a variant hides its attributes', async ({
  page
}) => {
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await canvas.clearCanvas()
  const ids = await seedVariantPropertyScene(page, 2)
  const choices = await page.evaluate((componentId) => {
    const editor = window.openPencil?.getStore?.()
    const component = editor?.graph.getNode(componentId)
    const set = component?.parentId ? editor?.graph.getNode(component.parentId) : undefined
    const alternate = set ? editor?.graph.getNode(set.childIds[1]) : undefined
    const text = alternate
      ? editor?.graph.getChildren(alternate.id).find((node) => node.type === 'TEXT')
      : undefined
    if (!editor || !component || !alternate || !text) throw new Error('Missing variants')
    editor.bindComponentProperty(text.id, 'TEXT', null)
    return {
      base: component.componentPropertyValues.Variant,
      alternate: alternate.componentPropertyValues.Variant
    }
  }, ids.componentId)
  await selectVariantPropertyNode(page, ids.instanceId)
  const variants = propertySection(page, 'Variants')
  const attributes = propertySection(page, 'Component properties')
  const label = attributes.getByRole('textbox', { name: 'Label', exact: true })
  await label.fill('Custom label')
  await label.blur()
  await variants.getByRole('combobox', { name: 'Variant', exact: true }).click()
  await page.getByRole('option', { name: choices.alternate, exact: true }).click()
  await expect(label).toHaveCount(0)
  await expect(variants).toBeVisible()
  await variants.getByRole('combobox', { name: 'Variant', exact: true }).click()
  await page.getByRole('option', { name: choices.base, exact: true }).click()
  await expect(label).toHaveValue('Custom label')
  canvas.assertNoErrors()
})

test('Add variant creates the set and manages shared and variant defaults through its panel', async ({
  page
}) => {
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await canvas.clearCanvas()
  await seedVariantPropertyScene(page)
  await propertySection(page, 'Variants')
    .getByRole('button', { name: 'Add variant', exact: true })
    .click()
  await expect.poll(async () => (await readVariantPropertyScene(page)).variants.length).toBe(2)
  await expect(
    page.getByRole('button', { name: 'Manage component set', exact: true })
  ).toBeVisible()
  await page.getByRole('button', { name: 'Manage component set', exact: true }).click()
  const manager = propertySection(page, 'Component properties')
  await manager.getByRole('button', { name: 'Component properties: Label', exact: true }).click()
  await expect(
    manager.getByRole('button', { name: 'Label All variants', exact: true })
  ).toBeVisible()
  await manager.getByRole('button', { name: 'Variant defaults', exact: true }).click()
  const variantValue = manager.getByRole('textbox', {
    name: 'Variant=Variant 2: Default value',
    exact: true
  })
  await variantValue.fill('Alternative')
  await variantValue.blur()
  await manager.getByRole('textbox', { name: 'Default value', exact: true }).fill('Shared')
  await manager.getByRole('textbox', { name: 'Default value', exact: true }).blur()
  await expect
    .poll(async () =>
      (await readVariantPropertyScene(page)).variants.map((variant) => variant.text)
    )
    .toEqual(['Shared', 'Alternative'])
  await manager.screenshot({ path: test.info().outputPath('variant-attributes.png') })
  await saveAndReopenPropertyDocument(page, test.info().outputPath('variant-defaults.fig'))
  await expect
    .poll(async () =>
      (await readVariantPropertyScene(page)).variants.map((variant) => variant.text)
    )
    .toEqual(['Shared', 'Alternative'])
  const state = await readVariantPropertyScene(page)
  if (!state.set) throw new Error('Missing set')
  await selectVariantPropertyNode(page, state.set.id)
  const expand = manager.getByRole('button', { name: 'Component properties: Label', exact: true })
  if ((await expand.getAttribute('aria-expanded')) !== 'true') await expand.click()
  await manager.getByRole('button', { name: 'Variant defaults', exact: true }).click()
  await expect(
    manager.getByRole('textbox', { name: 'Variant=Variant 2: Default value', exact: true })
  ).toHaveValue('Alternative')
  await manager
    .getByRole('button', { name: 'Use shared default: Variant=Variant 2', exact: true })
    .click()
  await expect
    .poll(async () =>
      (await readVariantPropertyScene(page)).variants.map((variant) => variant.text)
    )
    .toEqual(['Shared', 'Shared'])
  canvas.assertNoErrors()
})

test('23 variant bindings collapse into one row and an individual binding can be unlinked', async ({
  page
}) => {
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await canvas.clearCanvas()
  await seedVariantPropertyScene(page, 23)
  const manager = propertySection(page, 'Component properties')
  await expect(manager.locator('[data-property]')).toHaveCount(1)
  await manager.getByRole('button', { name: 'Component properties: Label', exact: true }).click()
  await expect(manager.getByRole('button', { name: /Unbind/ })).toHaveCount(0)
  await manager.getByRole('button', { name: 'Label All variants', exact: true }).click()
  await expect(manager.getByRole('button', { name: /Unbind/ })).toHaveCount(23)
  await manager
    .getByRole('button', { name: 'Unbind: Variant=Variant 2: Label', exact: true })
    .click()
  await expect(manager.getByRole('button', { name: /Unbind/ })).toHaveCount(22)
  await expect(
    manager.getByRole('button', { name: 'Label 22 of 23 variants', exact: true })
  ).toBeVisible()
  canvas.assertNoErrors()
})
