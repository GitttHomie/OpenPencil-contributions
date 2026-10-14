import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { propertyItems, propertySection } from '#tests/helpers/properties'

let page: Page
let canvas: CanvasHelper
let targetId = ''

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await page.goto('/')
  canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  targetId = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const pageId = store.state.currentPageId
    const fill = store.graph.createNode('RECTANGLE', pageId, {
      name: 'Brand/Primary',
      fills: [
        {
          type: 'SOLID',
          color: { r: 0.9, g: 0.2, b: 0.15, a: 1 },
          opacity: 1,
          visible: true
        }
      ],
      sharedStyleType: 'FILL',
      internalOnly: true
    })
    fill.source.id = '1:100'
    const text = store.graph.createNode('TEXT', pageId, {
      name: 'Type/Display',
      fontFamily: 'Inter',
      fontSize: 30,
      fontWeight: 700,
      lineHeight: 38,
      sharedStyleType: 'TEXT',
      internalOnly: true
    })
    text.source.id = '1:101'
    const effect = store.graph.createNode('RECTANGLE', pageId, {
      name: 'Effects/Card',
      effects: [
        {
          type: 'DROP_SHADOW',
          color: { r: 0, g: 0, b: 0, a: 0.25 },
          offset: { x: 0, y: 6 },
          radius: 12,
          spread: 0,
          visible: true
        }
      ],
      sharedStyleType: 'EFFECT',
      internalOnly: true
    })
    effect.source.id = '1:102'
    const grid = store.graph.createNode('FRAME', pageId, {
      name: 'Grid/12 columns',
      layoutGrids: [{ pattern: 'COLUMNS', count: 12, gutterSize: 16, visible: true }],
      sharedStyleType: 'GRID',
      internalOnly: true
    })
    grid.source.id = '1:103'
    const target = store.graph.createNode('FRAME', pageId, {
      name: 'Style target',
      x: 120,
      y: 100,
      width: 240,
      height: 160
    })
    store.select([target.id])
    store.requestRender()
    return target.id
  })
  await canvas.waitForRender()
})

test.afterAll(async () => {
  await page.close()
})

async function chooseStyle(section: string, label: string, option: string) {
  await propertySection(page, section).getByRole('combobox', { name: label }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
  await canvas.waitForRender()
}

async function targetStyles(id = targetId) {
  return page.evaluate((nodeId) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const node = store.graph.getNode(nodeId)
    return node
      ? {
          fillStyleId: node.fillStyleId,
          strokeStyleId: node.strokeStyleId,
          textStyleId: node.textStyleId,
          effectStyleId: node.effectStyleId,
          gridStyleId: node.gridStyleId,
          fillColor: node.fills[0]?.color,
          effects: node.effects.length,
          grids: node.layoutGrids.length,
          fontSize: node.fontSize
        }
      : null
  }, id)
}

test('unbound paint styles use one header action without redundant field labels', async () => {
  for (const [section, label] of [
    ['Fill', 'Fill style'],
    ['Stroke', 'Stroke style'],
    ['Effects', 'Effect style']
  ]) {
    const panel = propertySection(page, section)
    await expect(panel.getByRole('combobox', { name: label })).toHaveCount(1)
    await expect(panel.getByText(label, { exact: true })).toHaveCount(0)
    await expect(panel.getByText('None', { exact: true })).toHaveCount(0)
    await expect(panel).toHaveScreenshot(`${section.toLowerCase()}-unbound-style.png`)
  }
})

test('applies fill, stroke, effect, and grid styles from local definitions', async () => {
  await chooseStyle('Fill', 'Fill style', 'Brand/Primary')
  await chooseStyle('Stroke', 'Stroke style', 'Brand/Primary')
  await chooseStyle('Effects', 'Effect style', 'Effects/Card')
  await chooseStyle('Layout guide', 'Grid style', 'Grid/12 columns')
  await expect(propertySection(page, 'Fill')).toHaveScreenshot('fill-applied-style.png')
  await expect(propertySection(page, 'Effects')).toHaveScreenshot('effects-applied-style.png')

  expect(await targetStyles()).toMatchObject({
    fillStyleId: '1:100',
    strokeStyleId: '1:100',
    effectStyleId: '1:102',
    gridStyleId: '1:103',
    fillColor: { r: 0.9, g: 0.2, b: 0.15, a: 1 },
    effects: 1,
    grids: 1
  })
})

test('manual paint edits detach the style and undo restores the reference', async () => {
  await propertyItems(page, 'fills').first().hover()
  await propertySection(page, 'Fill').getByRole('button', { name: 'Remove fill' }).click()
  await canvas.waitForRender()
  expect((await targetStyles())?.fillStyleId).toBeNull()

  await canvas.pressKey('Meta+z')
  await canvas.waitForRender()
  expect(await targetStyles()).toMatchObject({ fillStyleId: '1:100', fillColor: { r: 0.9 } })
})

test('applies text styles and batches mixed selection binding', async () => {
  const textId = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const text = store.graph.createNode('TEXT', store.state.currentPageId, {
      name: 'Text target',
      text: 'Shared style',
      x: 420,
      y: 120
    })
    store.select([text.id])
    return text.id
  })
  await canvas.waitForRender()
  await chooseStyle('Typography', 'Text style', 'Type/Display')
  expect(await targetStyles(textId)).toMatchObject({
    textStyleId: '1:101',
    fontSize: 30
  })

  const secondId = await page.evaluate((firstId) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const second = store.graph.createNode('FRAME', store.state.currentPageId, {
      name: 'Second style target',
      x: 120,
      y: 320,
      width: 240,
      height: 120
    })
    store.select([firstId, second.id])
    return second.id
  }, targetId)
  await canvas.waitForRender()
  await chooseStyle('Fill', 'Fill style', 'Brand/Primary')
  expect((await targetStyles(targetId))?.fillStyleId).toBe('1:100')
  expect((await targetStyles(secondId))?.fillStyleId).toBe('1:100')

  await canvas.pressKey('Meta+z')
  await canvas.waitForRender()
  expect((await targetStyles(targetId))?.fillStyleId).toBe('1:100')
  expect((await targetStyles(secondId))?.fillStyleId).toBeNull()
})

test('switching a variable-backed text style updates the inspector tokens and supports undo', async () => {
  const target = await page.evaluate(() => {
    const store = window.openPencil.getStore()
    const graph = store.graph
    store.clearSelection()
    for (const node of graph.getChildren(store.state.currentPageId)) {
      if (!node.sharedStyleType) graph.deleteNode(node.id)
    }
    const collection = graph.createCollection('Typography test')
    const oldSize = graph.createVariable('Previous size', 'FLOAT', collection.id, 16)
    const size = graph.createVariable('Display size', 'FLOAT', collection.id, 30)
    const height = graph.createVariable('Display leading', 'FLOAT', collection.id, 38)
    const tracking = graph.createVariable('Display tracking', 'FLOAT', collection.id, 1)
    const style = [...graph.nodes.values()].find((node) => node.source.id === '1:101')
    if (!style) throw new Error('Missing text style')
    graph.updateNode(style.id, {
      letterSpacing: 1,
      boundVariables: { fontSize: size.id, lineHeight: height.id, letterSpacing: tracking.id }
    })
    const text = graph.createNode('TEXT', store.state.currentPageId, {
      name: 'Bound text target',
      text: 'Typography follows its tokens',
      fontSize: 16,
      textAutoResize: 'WIDTH_AND_HEIGHT',
      x: 420,
      y: 320,
      boundVariables: { fontSize: oldSize.id }
    })
    store.select([text.id])
    return { id: text.id, size: size.id, mode: collection.defaultModeId }
  })
  await canvas.waitForRender()
  const typography = propertySection(page, 'Typography')
  await expect(typography.getByText('Previous size', { exact: true })).toBeVisible()
  await chooseStyle('Typography', 'Text style', 'Type/Display')
  await expect(typography.getByText('Previous size', { exact: true })).toHaveCount(0)
  for (const name of ['Display size', 'Display leading', 'Display tracking']) {
    await expect(typography.getByText(name, { exact: true })).toBeVisible()
  }
  await expect(typography.locator('[data-property="fontSize"] [data-slot="pill"]')).toHaveText(
    'Display size30'
  )
  expect((await targetStyles(target.id))?.fontSize).toBe(30)
  expect(await canvas.screenshotCanvasRegion()).toMatchSnapshot('text-style-variable-bindings.png')

  await canvas.pressKey('Meta+z')
  await canvas.waitForRender()
  await expect(typography.getByText('Previous size', { exact: true })).toBeVisible()
  expect((await targetStyles(target.id))?.fontSize).toBe(16)
  await canvas.pressKey('Meta+Shift+z')
  await canvas.waitForRender()
  await expect(typography.getByText('Display size', { exact: true })).toBeVisible()

  await page.evaluate(({ size, mode }) => {
    window.openPencil.getStore().updateVariableValue(size, mode, 34)
  }, target)
  await canvas.waitForRender()
  await expect(typography.locator('[data-property="fontSize"] [data-slot="pill"]')).toHaveText(
    'Display size34'
  )
  expect((await targetStyles(target.id))?.fontSize).toBe(34)
})

test('unbound text gains style variables and switching to literal styles clears them', async () => {
  const fixture = await page.evaluate(() => {
    const store = window.openPencil.getStore()
    const graph = store.graph
    const collection = graph.createCollection('Style transitions')
    const family = graph.createVariable('font/family', 'STRING', collection.id, 'Inter')
    const styles = [24, 32].map((size, index) => {
      const bindings = {
        fontFamily: family.id,
        fontSize: graph.createVariable(`Size ${index}`, 'FLOAT', collection.id, size).id,
        lineHeight: graph.createVariable(`Leading ${index}`, 'FLOAT', collection.id, size + 8).id,
        letterSpacing: graph.createVariable(
          `Tracking ${index}`,
          'FLOAT',
          collection.id,
          -0.9599999785423279
        ).id
      }
      const definition = graph.createNode('TEXT', store.state.currentPageId, {
        name: `Transitions/Bound ${index}`,
        sharedStyleType: 'TEXT',
        internalOnly: true,
        boundVariables: bindings
      })
      definition.source.id = `8:${index}`
      return { name: definition.name, bindings, size }
    })
    const literal = graph.createNode('TEXT', store.state.currentPageId, {
      name: 'Transitions/Literal',
      sharedStyleType: 'TEXT',
      internalOnly: true,
      fontSize: 18
    })
    literal.source.id = '8:2'
    const target = graph.createNode('TEXT', store.state.currentPageId, {
      text: 'Initially without variables',
      fontSize: 16
    })
    store.select([target.id])
    return { id: target.id, styles, literal: literal.name }
  })
  const typography = propertySection(page, 'Typography')
  const bindings = () =>
    page.evaluate(
      (id) => window.openPencil.getStore().graph.getNode(id)?.boundVariables,
      fixture.id
    )
  await expect(typography.locator('[data-slot="pill"]')).toHaveCount(0)
  for (const [index, style] of fixture.styles.entries()) {
    await chooseStyle('Typography', 'Text style', style.name)
    expect(await bindings()).toEqual(style.bindings)
    await expect(
      typography.locator('[data-property="fontFamily-variable"] [data-slot="pill"]')
    ).toHaveText('font/familyInter')
    for (const field of ['fontSize', 'lineHeight', 'letterSpacing']) {
      await expect(
        typography.locator(`[data-property="${field}"] [data-slot="pill"]`)
      ).toBeVisible()
    }
    await expect(
      typography.locator('[data-property="letterSpacing"] [data-slot="pill"]')
    ).toHaveText(`Tracking ${index}-0.96px`)
    expect(
      await page.evaluate(
        (id) => window.openPencil.getStore().graph.getNode(id)?.letterSpacing,
        fixture.id
      )
    ).toBe(-0.9599999785423279)
    expect((await targetStyles(fixture.id))?.fontSize).toBe(style.size)
  }
  await chooseStyle('Typography', 'Text style', fixture.literal)
  expect(await bindings()).toEqual({})
  await expect(typography.locator('[data-slot="pill"]')).toHaveCount(0)
  expect((await targetStyles(fixture.id))?.fontSize).toBe(18)
  await canvas.pressKey('Meta+z')
  expect(await bindings()).toEqual(fixture.styles[1].bindings)
  await expect(typography.locator('[data-property="fontSize"] [data-slot="pill"]')).toHaveText(
    'Size 132'
  )
})

test('creates and updates text styles from the same picker', async () => {
  const ids = await page.evaluate(() => {
    const store = window.openPencil.getStore()
    store.clearSelection()
    for (const child of store.graph.getChildren(store.state.currentPageId)) {
      if (!child.sharedStyleType) store.graph.deleteNode(child.id)
    }
    const source = store.graph.createNode('TEXT', store.state.currentPageId, {
      text: 'Reusable typography',
      x: 300,
      y: 300,
      fontSize: 18,
      textAutoResize: 'WIDTH_AND_HEIGHT'
    })
    const follower = store.graph.createNode('TEXT', store.state.currentPageId, {
      text: 'Another use',
      x: 300,
      y: 400,
      fontSize: 18,
      textAutoResize: 'WIDTH_AND_HEIGHT'
    })
    store.select([source.id])
    store.requestRender()
    return { source: source.id, follower: follower.id }
  })
  const typography = propertySection(page, 'Typography')
  await typography.getByRole('combobox', { name: 'Text style' }).click()
  await page.getByRole('button', { name: 'Create new style…' }).click()
  await page.getByRole('textbox', { name: 'Style name' }).fill('Body / Article')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(typography.getByRole('combobox', { name: 'Text style' })).toContainText(
    'Body / Article'
  )
  await page.evaluate(({ follower }) => window.openPencil.getStore().select([follower]), ids)
  await chooseStyle('Typography', 'Text style', 'Body / Article')
  await page.evaluate(({ source }) => window.openPencil.getStore().select([source]), ids)
  await typography.getByRole('spinbutton', { name: 'Font size', exact: true }).click()
  const size = typography.locator('[data-property="fontSize"] input').first()
  await size.fill('26')
  await size.press('Enter')
  await expect(typography.getByRole('combobox', { name: 'Text style' })).toContainText('(modified)')
  expect((await targetStyles(ids.follower))?.fontSize).toBe(18)
  await typography.getByRole('combobox', { name: 'Text style' }).click()
  await page.getByRole('button', { name: 'Update style', exact: true }).click()
  await expect(typography.getByRole('combobox', { name: 'Text style' })).toHaveText(
    'Body / Article'
  )
  expect((await targetStyles(ids.follower))?.fontSize).toBe(26)
  expect(await canvas.screenshotCanvasRegion(650, 500)).toMatchSnapshot(
    'text-style-update-consumers.png'
  )
  await canvas.pressKey('Meta+z')
  await canvas.waitForRender()
  expect((await targetStyles(ids.follower))?.fontSize).toBe(18)
  expect((await targetStyles(ids.source))?.fontSize).toBe(26)
})

test('font weight variables create a family pair and offer compatible weights', async () => {
  const id = await page.evaluate(() => {
    const store = window.openPencil.getStore()
    store.clearSelection()
    for (const node of store.graph.getChildren(store.state.currentPageId)) {
      if (!node.sharedStyleType) store.graph.deleteNode(node.id)
    }
    const text = store.graph.createNode('TEXT', store.state.currentPageId, {
      text: 'Font variables',
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 28,
      textAutoResize: 'WIDTH_AND_HEIGHT',
      x: 200,
      y: 200
    })
    store.select([text.id])
    store.requestRender()
    return text.id
  })
  const typography = propertySection(page, 'Typography')
  const weight = typography.locator('[data-property="fontWeight-variable"]')
  await weight.getByRole('button', { name: 'Apply variable' }).click()
  await page.getByRole('button', { name: 'Create variable', exact: true }).click()
  await page.getByPlaceholder('Variable name').fill('Body weight')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(weight.locator('[data-slot="pill"]')).toHaveText('Body weight400')
  await expect(typography.locator('[data-property="fontFamily-variable"]')).toContainText(
    'Body weight / Family'
  )
  await page.evaluate((nodeId) => {
    const store = window.openPencil.getStore()
    const node = store.graph.getNode(nodeId)
    const variable = node && store.graph.variables.get(node.boundVariables.fontWeight)
    if (!variable) throw new Error('Missing font variable')
    const strong = store.graph.createVariable('Strong weight', 'FLOAT', variable.collectionId, 700)
    strong.fontFamilyVariableId = variable.fontFamilyVariableId
    store.graph.createVariable('Not a weight', 'FLOAT', variable.collectionId, 37)
    store.requestRefresh()
  }, id)
  await weight.getByRole('button', { name: 'Apply variable' }).click()
  await expect(page.getByRole('option', { name: /Not a weight/ })).toHaveCount(0)
  await page.getByRole('option', { name: /Strong weight/ }).click()
  await expect(weight.locator('[data-slot="pill"]')).toHaveText('Strong weight700')
  await canvas.waitForRender()
  expect(await canvas.screenshotCanvasRegion(650, 500)).toMatchSnapshot('font-weight-variable.png')
  await page.evaluate(() => window.openPencil.getStore().clearSelection())
  await page
    .getByRole('region', { name: 'Variables', exact: true })
    .getByRole('button', { name: 'Open variables' })
    .click()
  const dialog = page.getByTestId('variables-dialog')
  await dialog
    .getByRole('navigation', { name: 'Collections' })
    .getByRole('button', { name: /^Typography \d+$/ })
    .click()
  await dialog.getByTestId('variable-row').filter({ hasText: 'Strong weight' }).click()
  const inspector = page.getByTestId('token-inspector')
  await expect(inspector.getByText('Body weight / Family', { exact: true })).toBeVisible()
  await inspector.getByRole('combobox', { name: 'Value', exact: true }).click()
  await page.getByRole('option', { name: /Regular · 400/ }).click()
  expect(
    await page.evaluate(
      (nodeId) => window.openPencil.getStore().graph.getNode(nodeId)?.fontWeight,
      id
    )
  ).toBe(400)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})
