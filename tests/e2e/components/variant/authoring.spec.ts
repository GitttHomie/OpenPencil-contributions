import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { propertySection } from '#tests/helpers/properties'

test('authors multiple variant dimensions and reports duplicate combinations', async ({ page }) => {
  const canvas = new CanvasHelper(page)
  await page.goto('/?test')
  await canvas.waitForInit()

  const ids = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const pageId = store.state.currentPageId
    const componentSet = store.graph.createNode('COMPONENT_SET', pageId, {
      name: 'Button',
      componentPropertyDefinitions: [
        {
          id: '50:1',
          name: 'Variant',
          type: 'VARIANT',
          defaultValue: 'Primary',
          variantOptions: ['Primary', 'Secondary']
        },
        {
          id: '50:2',
          name: 'Property 2',
          type: 'VARIANT',
          defaultValue: 'Small',
          variantOptions: ['Small', 'Large']
        }
      ]
    })
    const primarySmall = store.graph.createNode('COMPONENT', componentSet.id, {
      name: 'Variant=Primary, Property 2=Small',
      componentPropertyValues: { Variant: 'Primary', 'Property 2': 'Small' }
    })
    const primaryLarge = store.graph.createNode('COMPONENT', componentSet.id, {
      name: 'Variant=Primary, Property 2=Large',
      x: 160,
      componentPropertyValues: { Variant: 'Primary', 'Property 2': 'Large' }
    })
    const secondarySmall = store.graph.createNode('COMPONENT', componentSet.id, {
      name: 'Variant=Secondary, Property 2=Small',
      y: 120,
      componentPropertyValues: { Variant: 'Secondary', 'Property 2': 'Small' }
    })
    store.select([componentSet.id])
    return {
      componentSetId: componentSet.id,
      primarySmallId: primarySmall.id,
      primaryLargeId: primaryLarge.id,
      secondarySmallId: secondarySmall.id
    }
  })
  await canvas.waitForRender()

  const section = propertySection(page, 'Variants')
  await expect(section).toBeVisible()
  const propertyRows = section.locator('[data-property]')
  await expect(propertyRows).toHaveCount(2)
  await propertyRows.nth(0).getByRole('textbox', { name: 'Property name' }).fill('Type')
  await propertyRows.nth(0).getByRole('textbox', { name: 'Property name' }).blur()
  await canvas.waitForRender()
  await propertyRows.nth(1).getByRole('textbox', { name: 'Property name' }).fill('Size')
  await propertyRows.nth(1).getByRole('textbox', { name: 'Property name' }).blur()
  await canvas.waitForRender()

  await section.getByRole('button', { name: 'Variant properties: Size', exact: true }).click()
  const sizeCard = propertyRows.nth(1)
  await sizeCard.getByRole('textbox', { name: 'Add value', exact: true }).fill('Medium')
  await sizeCard.getByRole('button', { name: 'Add value', exact: true }).click()
  await section.getByRole('button', { name: 'Add variant property', exact: true }).click()
  const form = section
    .locator('form')
    .filter({ has: page.getByRole('textbox', { name: 'Property name', exact: true }) })
  await form.getByRole('textbox', { name: 'Property name', exact: true }).fill('State')
  await form.getByRole('button', { name: 'Create', exact: true }).click()

  const definitions = await page.evaluate((componentSetId) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.graph.getNode(componentSetId)?.componentPropertyDefinitions
  }, ids.componentSetId)
  expect(definitions?.map((definition) => definition.name)).toEqual(['Type', 'Size', 'State'])

  await page.evaluate((variantId) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.select([variantId])
  }, ids.primaryLargeId)
  await canvas.waitForRender()

  const variantSection = propertySection(page, 'Variants')
  await expect(variantSection.getByRole('combobox', { name: 'Type', exact: true })).toContainText(
    'Primary'
  )
  await expect(variantSection.getByRole('combobox', { name: 'Size', exact: true })).toContainText(
    'Large'
  )
  await expect(variantSection.getByRole('combobox', { name: 'State', exact: true })).toContainText(
    'Default'
  )
  await variantSection.getByRole('combobox', { name: 'Size', exact: true }).click()
  await page.getByRole('option', { name: 'Small', exact: true }).click()
  await expect(variantSection.getByRole('alert')).toContainText('Duplicate variant values')
  await expect(variantSection.getByRole('alert').locator('[data-node-id]')).toHaveCount(2)
  await expect(variantSection.getByRole('combobox', { name: 'Size', exact: true })).toContainText(
    'Large'
  )

  const state = await page.evaluate((variantId) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const node = store.graph.getNode(variantId)
    return node
      ? { name: node.name, values: node.componentPropertyValues, undoLabel: store.undo.undoLabel }
      : null
  }, ids.primaryLargeId)
  expect(state).toEqual({
    name: 'Type=Primary, Size=Large, State=Default',
    values: { Type: 'Primary', Size: 'Large', State: 'Default' },
    undoLabel: 'Add property'
  })

  await variantSection.getByRole('combobox', { name: 'Size', exact: true }).click()
  await page.getByRole('option', { name: 'Medium', exact: true }).click()
  await canvas.waitForRender()
  await expect(variantSection.getByRole('alert')).toHaveCount(0)
  await expect(variantSection.getByRole('combobox', { name: 'Size', exact: true })).toContainText(
    'Medium'
  )

  await canvas.pressKey('Meta+z')
  await canvas.waitForRender()
  await expect(variantSection.getByRole('alert')).toHaveCount(0)
  await expect(variantSection.getByRole('combobox', { name: 'Size', exact: true })).toContainText(
    'Large'
  )
  await page.evaluate((id) => window.openPencil?.getStore?.().select([id]), ids.componentSetId)
  await section
    .locator('[data-property="50:1"]')
    .getByRole('button', { name: 'Remove variant property', exact: true })
    .click()
  await expect(section.getByRole('alert').locator('[data-node-id]')).toHaveCount(2)
  await section.getByRole('alert').locator(`[data-node-id="${ids.secondarySmallId}"]`).click()
  await expect(variantSection.getByRole('alert').locator('[data-node-id]')).toHaveCount(2)
  await variantSection.getByRole('combobox', { name: 'Size', exact: true }).click()
  await page.getByRole('option', { name: 'Medium', exact: true }).click()
  await expect(variantSection.getByRole('alert')).toHaveCount(0)
  await page.evaluate((id) => window.openPencil?.getStore?.().select([id]), ids.componentSetId)
  await expect(section.getByRole('alert')).toHaveCount(0)
  canvas.assertNoErrors()
})
