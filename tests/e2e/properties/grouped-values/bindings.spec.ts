import { expect, test, type Locator, type Page } from '@playwright/test'

import { propertyField, propertySection } from '#tests/helpers/properties'
import { createGroupedValuesScene } from '#tests/helpers/properties/grouped-values'

async function bind(page: Page, field: Locator, name: string) {
  await field.getByRole('button', { name: 'Apply variable' }).click()
  await page.getByRole('option', { name, exact: true }).click()
}
async function detach(page: Page, field: Locator) {
  await field.getByRole('button', { name: 'Apply variable' }).click()
  await page.getByRole('button', { name: 'Detach variable', exact: true }).click()
}
async function type(field: Locator, value: string, finish = 'Enter') {
  await field.click({ position: { x: 25, y: 12 } })
  const input = field.getByRole('spinbutton')
  await input.fill(value)
  await input.press(finish)
}

test('padding pairs bind both sides and retain mixed bindings when collapsed', async ({ page }) => {
  const scene = await createGroupedValuesScene(page)
  const horizontal = page.getByTestId('layout-horizontal-padding-input')
  await bind(page, horizontal, 'Size/medium')
  expect((await scene.read()).bindings).toMatchObject({
    paddingLeft: scene.variableId,
    paddingRight: scene.variableId
  })
  const toggle = page.getByRole('button', { name: 'Individual padding', exact: true })
  await toggle.click()
  await expect(propertyField(page, 'paddingRight')).toContainText('Size/medium')
  await detach(page, propertyField(page, 'paddingRight'))
  const before = await scene.read()
  await toggle.click()
  await expect(horizontal).toContainText('16')
  await expect(horizontal.getByLabel('Mixed bindings', { exact: true })).toBeVisible()
  expect(await scene.read()).toEqual(before)
  await toggle.click()
  await bind(page, propertyField(page, 'paddingRight'), 'Size/other')
  await toggle.click()
  await expect(horizontal.getByLabel('Mixed bindings', { exact: true })).toBeVisible()
  await type(horizontal, '8')
  expect((await scene.read()).padding).toEqual([8, 8, 16, 16])
  expect((await scene.read()).bindings.paddingLeft).toBeUndefined()
  expect((await scene.read()).bindings.paddingRight).toBeUndefined()
  await scene.canvas.pressKey('Meta+z')
  expect((await scene.read()).bindings).toMatchObject({
    paddingLeft: scene.variableId,
    paddingRight: scene.otherId
  })
  scene.canvas.assertNoErrors()
})

test('corners expand without conversion and a new grouped variable binds all four sides', async ({
  page
}) => {
  const scene = await createGroupedValuesScene(page)
  const toggle = propertySection(page, 'Appearance').getByRole('button', {
    name: 'Independent corner radii'
  })
  const original = await scene.read()
  await toggle.click()
  for (const path of ['topLeftRadius', 'topRightRadius', 'bottomRightRadius', 'bottomLeftRadius']) {
    await expect(propertyField(page, path)).toContainText('Size/medium')
  }
  expect(await scene.read()).toEqual(original)
  await type(propertyField(page, 'topLeftRadius'), '24', 'Escape')
  expect(await scene.read()).toEqual(original)
  await detach(page, propertyField(page, 'topLeftRadius'))
  await toggle.click()
  const field = propertyField(page, 'cornerRadius')
  await expect(field.getByLabel('Mixed bindings', { exact: true })).toBeVisible()
  const mixed = await scene.read()
  await field.getByRole('button', { name: 'Apply variable' }).click()
  await page.getByRole('button', { name: /Create number variable/ }).click()
  await page.getByPlaceholder('Variable name', { exact: true }).fill('Radius/new')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(field).toContainText('Radius/new')
  const created = await scene.read()
  const variable = created.variables.find((v) => v.name === 'Radius/new')
  expect(variable).toBeDefined()
  expect(
    ['topLeftRadius', 'topRightRadius', 'bottomRightRadius', 'bottomLeftRadius'].map(
      (path) => created.bindings[path]
    )
  ).toEqual(Array.from({ length: 4 }, () => variable?.id))
  await scene.canvas.pressKey('Meta+z')
  expect(await scene.read()).toEqual(mixed)
  await type(field, '24', 'Escape')
  expect(await scene.read()).toEqual(mixed)
  await type(field, '24')
  expect((await scene.read()).corners).toEqual([24, 24, 24, 24])
  await expect(field).toBeVisible()
  await scene.canvas.pressKey('Meta+z')
  expect(await scene.read()).toEqual(mixed)
  scene.canvas.assertNoErrors()
})

test('mixed values cannot be scrubbed into an arbitrary shared value', async ({ page }) => {
  const scene = await createGroupedValuesScene(page)
  const toggle = page.getByRole('button', { name: 'Individual padding', exact: true })
  await toggle.click()
  await type(propertyField(page, 'paddingRight'), '32')
  await toggle.click()
  const field = page.getByTestId('layout-horizontal-padding-input')
  await expect(field).toContainText('Mixed')
  const before = await scene.read()
  const box = await field.boundingBox()
  if (!box) throw new Error('Missing padding field')
  await page.mouse.move(box.x + 20, box.y + 12)
  await page.mouse.down()
  await page.mouse.move(box.x + 55, box.y + 12, { steps: 5 })
  await page.mouse.up()
  await page.keyboard.press('Escape')
  expect(await scene.read()).toEqual(before)
  await type(field, '20')
  expect((await scene.read()).padding).toEqual([20, 20, 16, 16])
  await scene.canvas.pressKey('Meta+z')
  expect((await scene.read()).padding).toEqual(before.padding)
})

test('grid gap fields expose independent variable bindings', async ({ page }) => {
  const scene = await createGroupedValuesScene(page, true)
  await bind(page, propertyField(page, 'gridColumnGap'), 'Size/medium')
  await bind(page, propertyField(page, 'gridRowGap'), 'Size/other')
  expect((await scene.read()).bindings).toMatchObject({
    gridColumnGap: scene.variableId,
    gridRowGap: scene.otherId
  })
  scene.canvas.assertNoErrors()
})

test('border variables cover every side and stay independent after collapse', async ({ page }) => {
  const scene = await createGroupedValuesScene(page)
  const field = propertyField(page, 'stroke-weight')
  await bind(page, field, 'Size/medium')
  expect((await scene.read()).border).toEqual([16, 16, 16, 16])
  await propertyField(page, 'stroke-sides').click()
  await detach(page, propertyField(page, 'stroke-right-weight'))
  const detached = await scene.read()
  await propertyField(page, 'stroke-sides').click()
  await expect(field.getByLabel('Mixed bindings', { exact: true })).toBeVisible()
  expect(await scene.read()).toEqual(detached)
  await test.info().attach('mixed-border-bindings', {
    body: await propertySection(page, 'Stroke').screenshot(),
    contentType: 'image/png'
  })
  await scene.canvas.pressKey('Meta+z')
  await expect(field).toContainText('Size/medium')
  expect((await scene.read()).bindings.borderRightWeight).toBe(scene.variableId)
})
