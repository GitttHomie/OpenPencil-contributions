import { test, expect, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

let page: Page
let canvas: CanvasHelper

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await page.goto('/?test&no-chrome&no-rulers')
  canvas = new CanvasHelper(page)
  await canvas.waitForInit()
})

test.afterAll(async () => {
  await page.close()
})

test.beforeEach(async () => {
  await canvas.clearCanvas()
})

test('only the component set has a canvas label, which selects and moves the set', async () => {
  const setId = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const graph = store.graph
    const pageId = graph.getPages()[0].id
    const set = graph.createNode('COMPONENT_SET', pageId, {
      name: 'Button',
      x: 100,
      y: 100,
      width: 220,
      height: 120,
      fills: [],
      strokes: []
    })
    graph.createNode('COMPONENT', set.id, {
      name: 'Primary',
      x: 20,
      y: 40,
      width: 120,
      height: 40,
      cornerRadius: 8,
      fills: [
        { type: 'SOLID', color: { r: 0.25, g: 0.49, b: 0.95, a: 1 }, opacity: 1, visible: true }
      ]
    })
    store.state.zoom = 2
    store.state.panX = 80
    store.state.panY = 80
    store.clearSelection()
    store.requestRender()
    return set.id
  })
  await canvas.waitForRender()

  const box = await page.getByTestId('canvas-element').boundingBox()
  if (!box) throw new Error('No canvas')

  await expect(page).toHaveScreenshot('component-set-label.png', {
    clip: { x: box.x + 275, y: box.y + 250, width: 450, height: 280 },
    maxDiffPixels: 0,
    threshold: 0
  })
  await page.mouse.click(box.x + 310, box.y + 269)
  await canvas.waitForRender()

  const selected = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return [...store.state.selectedIds]
  })
  expect(selected).toEqual([setId])
  await page.mouse.move(box.x + 310, box.y + 269)
  await page.mouse.down()
  await page.mouse.move(box.x + 350, box.y + 309, { steps: 5 })
  await page.mouse.up()
  await expect
    .poll(() =>
      page.evaluate((id) => {
        const node = window.openPencil?.getStore?.().graph.getNode(id)
        return node ? { x: node.x, y: node.y } : null
      }, setId)
    )
    .toEqual({ x: 120, y: 120 })
  canvas.assertNoErrors()
})
