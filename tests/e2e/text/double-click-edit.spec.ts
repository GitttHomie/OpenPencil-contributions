import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { getEditingTextId, getSelectedNode } from '#tests/helpers/store'

async function addTwoTopLevelTexts(page: Page) {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.state.zoom = 1
    store.state.panX = 0
    store.state.panY = 0
    const first = store.createShape('TEXT', 200, 200, 150, 30)
    const second = store.createShape('TEXT', 200, 250, 150, 30)
    store.graph.updateNode(first, { text: 'First label', fontSize: 18 })
    store.graph.updateNode(second, { text: 'Second label', fontSize: 18 })
    store.select([first])
    store.requestRender()
    return { first, second }
  })
}

async function addTopLevelText(page: Page) {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.state.zoom = 1
    store.state.panX = 0
    store.state.panY = 0
    const id = store.createShape('TEXT', 200, 200, 150, 30)
    store.graph.updateNode(id, { text: 'Hello World', fontSize: 18 })
    store.select([id])
    store.requestRender()
    return id
  })
}

async function addFrameWithNestedText(page: Page) {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.state.zoom = 1
    store.state.panX = 0
    store.state.panY = 0

    const pageId = store.state.currentPageId
    const frame = store.graph.createNode('FRAME', pageId, {
      name: 'Card',
      x: 100,
      y: 100,
      width: 220,
      height: 120,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]
    })
    const text = store.graph.createNode('TEXT', frame.id, {
      name: 'Nested label',
      text: 'Nested label',
      x: 20,
      y: 20,
      width: 140,
      height: 30,
      fontSize: 18
    })
    store.select([frame.id])
    store.requestRender()
    return { frameId: frame.id, textId: text.id }
  })
}

test('double-clicking top-level text enters text edit mode', async ({ page }) => {
  await page.goto('/')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  canvas.errors.length = 0
  await canvas.clearCanvas()

  const textId = await addTopLevelText(page)
  await canvas.waitForRender()
  await canvas.pressKey('Escape')
  await canvas.dblclick(275, 215)

  await expect.poll(() => getEditingTextId(page), { timeout: 3000 }).toBe(textId)
})

test('single-clicking another text selects it; double-clicking edits it', async ({ page }) => {
  await page.goto('/')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  canvas.errors.length = 0
  await canvas.clearCanvas()

  const ids = await addTwoTopLevelTexts(page)
  await canvas.waitForRender()
  await canvas.dblclick(245, 215)
  await expect.poll(() => getEditingTextId(page), { timeout: 3000 }).toBe(ids.first)

  await canvas.click(250, 265)
  await expect.poll(() => getEditingTextId(page)).toBeNull()
  await expect.poll(() => getSelectedNode(page)).toMatchObject({ id: ids.second })
  await canvas.dblclick(250, 265)
  await expect.poll(() => getEditingTextId(page), { timeout: 3000 }).toBe(ids.second)
})

test('single clicks select nested text; a double-click edits it', async ({ page }) => {
  await page.goto('/')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  canvas.errors.length = 0
  await canvas.clearCanvas()

  const ids = await addFrameWithNestedText(page)
  await canvas.waitForRender()

  await canvas.click(125, 125)

  await expect.poll(() => getSelectedNode(page)).toMatchObject({ id: ids.textId })
  await expect.poll(() => getEditingTextId(page)).toBeNull()

  await canvas.click(145, 135)
  await expect.poll(() => getEditingTextId(page)).toBeNull()
  await canvas.dblclick(145, 135)
  await expect.poll(() => getEditingTextId(page), { timeout: 3000 }).toBe(ids.textId)
  await expect.poll(() => getSelectedNode(page)).toMatchObject({ id: ids.textId })
  await page.keyboard.press('ArrowRight')
  await page.keyboard.type('!')
  await expect
    .poll(async () => {
      const text = (await getSelectedNode(page))?.text ?? ''
      return { original: text.replace('!', ''), length: text.length }
    })
    .toEqual({ original: 'Nested label', length: 'Nested label!'.length })
})

test('dragging selected nested text moves it without entering text editing', async ({ page }) => {
  await page.goto('/')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await canvas.clearCanvas()
  const ids = await addFrameWithNestedText(page)
  await canvas.waitForRender()

  await canvas.click(145, 135)
  await expect.poll(() => getSelectedNode(page)).toMatchObject({ id: ids.textId })
  await expect.poll(() => getEditingTextId(page)).toBeNull()

  await canvas.drag(145, 135, 175, 165)
  await expect
    .poll(() => getSelectedNode(page))
    .toMatchObject({
      id: ids.textId,
      x: 50,
      y: 50
    })
  await expect.poll(() => getEditingTextId(page)).toBeNull()

  await canvas.click(175, 165)
  await expect.poll(() => getEditingTextId(page)).toBeNull()
  await canvas.dblclick(175, 165)
  await expect.poll(() => getEditingTextId(page)).toBe(ids.textId)
})
