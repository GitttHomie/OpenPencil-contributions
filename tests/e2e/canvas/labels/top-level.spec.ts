import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

async function setup(page: Page) {
  await page.goto('/?test&no-chrome&no-rulers')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  const ids = await page.evaluate(() => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Editor unavailable')
    editor.zoomTo100()
    editor.pan(-editor.state.panX, -editor.state.panY)
    const pageId = editor.state.currentPageId
    const nodes = ['FRAME', 'RECTANGLE', 'ELLIPSE', 'TEXT', 'GROUP', 'VECTOR', 'LINE'] as const
    const ids = nodes.map((type, index) => {
      const node = editor.graph.createNode(type, pageId, {
        name: `${type.toLowerCase()} label`,
        text: type === 'TEXT' ? 'Sample text' : '',
        x: 70 + (index % 3) * 210,
        y: 90 + Math.floor(index / 3) * 150,
        width: 150,
        height: type === 'LINE' ? 0 : 90,
        fills:
          type === 'GROUP' || type === 'LINE'
            ? []
            : [
                {
                  type: 'SOLID',
                  color: { r: 0.4, g: 0.6, b: 0.9, a: 1 },
                  visible: true,
                  opacity: 1
                }
              ],
        strokes:
          type === 'LINE'
            ? [
                {
                  type: 'SOLID',
                  color: { r: 0.2, g: 0.2, b: 0.2, a: 1 },
                  visible: true,
                  opacity: 1,
                  weight: 2,
                  align: 'CENTER'
                }
              ]
            : []
      })
      if (type === 'FRAME')
        editor.graph.createNode('RECTANGLE', node.id, {
          name: 'Nested child',
          x: 20,
          y: 30,
          width: 50,
          height: 40
        })
      return node.id
    })
    editor.clearSelection()
    editor.requestRender()
    return ids
  })
  return { canvas, ids }
}

async function selection(page: Page) {
  return page.evaluate(() => [...(window.openPencil?.getStore?.().state.selectedIds ?? [])])
}

test('top-level names remain visible without a selection', async ({ page }) => {
  const { canvas } = await setup(page)
  await page.mouse.move(10, 10)
  await canvas.waitForRender()
  expect(await selection(page)).toEqual([])
  expect(await canvas.screenshotCanvasRegion(720, 470)).toMatchSnapshot(
    'unselected-top-level-names.png'
  )
  canvas.assertNoErrors()
})

test('right-clicking unselected names targets their nodes and preserves an existing multi-selection', async ({
  page
}) => {
  const { canvas, ids } = await setup(page)
  for (const [index, id] of ids.entries()) {
    await canvas.canvas.click({
      position: { x: 80 + (index % 3) * 210, y: 80 + Math.floor(index / 3) * 150 },
      button: 'right'
    })
    await expect(page.getByTestId('context-copy')).toBeVisible()
    expect(await selection(page)).toEqual([id])
    await page.keyboard.press('Escape')
  }
  await page.evaluate((ids) => window.openPencil?.getStore?.().select(ids.slice(0, 2)), ids)
  await canvas.canvas.click({ position: { x: 80, y: 80 }, button: 'right' })
  expect(await selection(page)).toEqual(ids.slice(0, 2))
  await page.keyboard.press('Escape')
  await canvas.canvas.click({ position: { x: 500, y: 80 }, button: 'right' })
  await page.getByTestId('context-delete').click()
  await expect
    .poll(() => page.evaluate((id) => !!window.openPencil?.getStore?.().graph.getNode(id), ids[2]))
    .toBe(false)
  canvas.assertNoErrors()
})

test('unselected ordinary node names support inline renaming and dragging', async ({ page }) => {
  const { canvas, ids } = await setup(page)
  await canvas.canvas.dblclick({ position: { x: 300, y: 80 } })
  const name = page.getByRole('textbox', { name: 'Layer name' })
  await expect(name).toHaveValue('rectangle label')
  await name.fill('Renamed rectangle')
  await name.press('Enter')
  await expect
    .poll(() =>
      page.evaluate((id) => window.openPencil?.getStore?.().graph.getNode(id)?.name, ids[1])
    )
    .toBe('Renamed rectangle')
  await page.evaluate(() => window.openPencil?.getStore?.().clearSelection())
  const bounds = await canvas.canvas.boundingBox()
  if (!bounds) throw new Error('Canvas unavailable')
  await page.mouse.move(bounds.x + 300, bounds.y + 80)
  await page.mouse.down()
  await page.mouse.move(bounds.x + 320, bounds.y + 110, { steps: 5 })
  await page.mouse.up()
  await expect
    .poll(() =>
      page.evaluate((id) => {
        const node = window.openPencil?.getStore?.().graph.getNode(id)
        return node ? { x: node.x, y: node.y } : null
      }, ids[1])
    )
    .toEqual({ x: 300, y: 120 })
  canvas.assertNoErrors()
})
