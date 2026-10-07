import { expect, test } from '@playwright/test'
import type { Locator } from '@playwright/test'

import { propertyField, propertySection } from '#tests/helpers/properties'
import { createMultiSelectionScene } from '#tests/helpers/properties/multi-selection'

async function type(field: Locator, value: string) {
  await field.click({ position: { x: 25, y: 12 } })
  const input = field.getByRole('spinbutton')
  await input.fill(value)
  await input.press('Enter')
}

test('text and frame expose shared dimensions, show Mixed, and undo both together', async ({
  page
}) => {
  const scene = await createMultiSelectionScene(page, 'mixed')
  await expect(propertySection(page, 'Typography')).toHaveCount(0)
  await expect(propertyField(page, 'width')).toContainText('Mixed')
  await type(propertyField(page, 'width'), '150.5')
  await expect
    .poll(async () => (await scene.read()).map((node) => node.width))
    .toEqual([150.5, 150.5])
  await scene.canvas.pressKey('Meta+z')
  await expect.poll(async () => (await scene.read()).map((node) => node.width)).toEqual([100, 180])
  scene.canvas.assertNoErrors()
})

test('all text exposes mixed typography and applies font size and weight to the whole selection', async ({
  page
}, testInfo) => {
  const scene = await createMultiSelectionScene(page, 'text')
  const typography = propertySection(page, 'Typography')
  await expect(typography.getByRole('button', { name: 'Font family', exact: true })).toHaveText(
    'Mixed'
  )
  await expect(propertyField(page, 'fontSize')).toContainText('Mixed')
  await type(propertyField(page, 'fontSize'), '32')
  await expect.poll(async () => (await scene.read()).map((node) => node.fontSize)).toEqual([32, 32])
  expect((await scene.read()).map((node) => node.textAutoResize)).toEqual(['NONE', 'NONE'])
  await scene.canvas.pressKey('Meta+z')
  await expect.poll(async () => (await scene.read()).map((node) => node.fontSize)).toEqual([16, 24])
  await typography.getByRole('combobox', { name: 'Font weight', exact: true }).click()
  await page.getByRole('option', { name: 'Regular', exact: true }).click()
  await expect
    .poll(async () => (await scene.read()).map((node) => node.fontWeight))
    .toEqual([400, 400])
  await scene.canvas.pressKey('Meta+z')
  await expect
    .poll(async () => (await scene.read()).map((node) => node.fontWeight))
    .toEqual([400, 600])
  await typography.getByRole('button', { name: 'Font family', exact: true }).click()
  await page.getByRole('combobox', { name: 'Search fonts…' }).fill('Inter')
  await page.getByRole('option', { name: 'Inter bundled', exact: true }).click()
  await expect
    .poll(async () => (await scene.read()).map((node) => node.fontFamily))
    .toEqual(['Inter', 'Inter'])
  await scene.canvas.pressKey('Meta+z')
  await expect
    .poll(async () => (await scene.read()).map((node) => node.fontFamily))
    .toEqual(['Inter', 'Roboto'])
  await page.screenshot({ path: testInfo.outputPath('multi-text.png') })
  scene.canvas.assertNoErrors()
})

test('frame and component share flow, gap and padding controls with grouped undo', async ({
  page
}) => {
  const scene = await createMultiSelectionScene(page, 'containers')
  await propertySection(page, 'Auto layout')
    .getByRole('button', { name: 'Horizontal layout', exact: true })
    .click()
  await expect
    .poll(async () => (await scene.read()).map((node) => node.layoutMode))
    .toEqual(['HORIZONTAL', 'HORIZONTAL'])
  await expect(propertyField(page, 'itemSpacing')).toContainText('Mixed')
  await type(propertyField(page, 'itemSpacing'), '24')
  await expect
    .poll(async () => (await scene.read()).map((node) => node.itemSpacing))
    .toEqual([24, 24])
  await scene.canvas.pressKey('Meta+z')
  await expect
    .poll(async () => (await scene.read()).map((node) => node.itemSpacing))
    .toEqual([8, 16])
  await type(propertyField(page, 'paddingLeft'), '12')
  await expect
    .poll(async () => (await scene.read()).map((node) => node.paddingLeft))
    .toEqual([12, 12])
  await scene.canvas.pressKey('Meta+z')
  await expect
    .poll(async () => (await scene.read()).map((node) => node.paddingLeft))
    .toEqual([8, 16])
  await scene.canvas.pressKey('Meta+z')
  await expect
    .poll(async () => (await scene.read()).map((node) => node.layoutMode))
    .toEqual(['VERTICAL', 'VERTICAL'])
  scene.canvas.assertNoErrors()
})

test('shared dimensions keep limits optional and apply each object’s current size', async ({
  page
}) => {
  const scene = await createMultiSelectionScene(page, 'mixed')
  for (const property of ['minWidth', 'maxWidth', 'minHeight', 'maxHeight']) {
    await expect(propertyField(page, property)).toHaveCount(0)
  }
  await propertyField(page, 'width').getByRole('combobox', { name: 'Width', exact: true }).click()
  await page.getByRole('option', { name: 'Add min width', exact: true }).click()
  await expect
    .poll(async () => (await scene.read()).map((node) => node.minWidth))
    .toEqual([100, 180])
  await expect(propertyField(page, 'minWidth')).toContainText('Mixed')
  await scene.canvas.pressKey('Meta+z')
  await expect(propertyField(page, 'minWidth')).toHaveCount(0)
  scene.canvas.assertNoErrors()
})

test('text icon controls apply to all selected nodes and undo restores differing values', async ({
  page
}, testInfo) => {
  const scene = await createMultiSelectionScene(page, 'text')
  const typography = propertySection(page, 'Typography')
  const left = typography.getByRole('button', { name: 'Align left', exact: true })
  const right = typography.getByRole('button', { name: 'Align right', exact: true })
  await expect(left).toHaveAttribute('aria-pressed', 'false')
  await expect(right).toHaveAttribute('aria-pressed', 'false')
  await right.click()
  await expect
    .poll(async () => (await scene.read()).map((node) => node.textAlignHorizontal))
    .toEqual(['RIGHT', 'RIGHT'])
  await scene.canvas.pressKey('Meta+z')
  await expect
    .poll(async () => (await scene.read()).map((node) => node.textAlignHorizontal))
    .toEqual(['LEFT', 'RIGHT'])
  await typography.getByRole('button', { name: 'Align bottom', exact: true }).click()
  await expect
    .poll(async () => (await scene.read()).map((node) => node.textAlignVertical))
    .toEqual(['BOTTOM', 'BOTTOM'])
  await scene.canvas.pressKey('Meta+z')
  await expect
    .poll(async () => (await scene.read()).map((node) => node.textAlignVertical))
    .toEqual(['TOP', 'BOTTOM'])
  await typography.getByRole('button', { name: /^Underline/ }).click()
  await expect
    .poll(async () => (await scene.read()).map((node) => node.textDecoration))
    .toEqual(['UNDERLINE', 'UNDERLINE'])
  await scene.canvas.pressKey('Meta+z')
  await expect
    .poll(async () => (await scene.read()).map((node) => node.textDecoration))
    .toEqual(['NONE', 'UNDERLINE'])
  await propertySection(page, 'Layout')
    .getByRole('button', { name: 'Auto width', exact: true })
    .click()
  await expect
    .poll(async () => (await scene.read()).map((node) => node.textAutoResize))
    .toEqual(['WIDTH_AND_HEIGHT', 'WIDTH_AND_HEIGHT'])
  await scene.canvas.pressKey('Meta+z')
  await expect
    .poll(async () => (await scene.read()).map((node) => node.textAutoResize))
    .toEqual(['NONE', 'NONE'])
  await page.screenshot({
    path: testInfo.outputPath('multi-selection-controls.png'),
    fullPage: true
  })
  scene.canvas.assertNoErrors()
})
