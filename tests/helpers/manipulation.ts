import type { Page } from '@playwright/test'

import { CanvasHelper } from './canvas'

export async function createManipulationScene(page: Page, autoLayout = false) {
  await page.goto('/?test&no-rulers')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  const ids = await page.evaluate((autoLayout) => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Editor unavailable')
    editor.state.panX = 0
    editor.state.panY = 0
    editor.state.zoom = 1
    editor.state.snappingPreferences = { geometry: false, objects: false, pixelGrid: false }
    const frame = editor.graph.createNode('FRAME', editor.state.currentPageId, {
      name: 'Source',
      x: 80,
      y: 80,
      width: 360,
      height: 160,
      layoutMode: autoLayout ? 'HORIZONTAL' : 'NONE',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED',
      paddingLeft: 20,
      paddingTop: 20,
      itemSpacing: 20,
      fills: [
        { type: 'SOLID', color: { r: 0.16, g: 0.2, b: 0.24, a: 1 }, opacity: 1, visible: true }
      ]
    })
    const children = ['A', 'B', 'C'].map((name, i) =>
      editor.graph.createNode('RECTANGLE', frame.id, {
        name,
        x: 20 + i * 100,
        y: 20,
        width: 80,
        height: 60,
        fills: [
          { type: 'SOLID', color: { r: 0.3, g: 0.55, b: 0.7, a: 1 }, opacity: 1, visible: true }
        ]
      })
    )
    const target = editor.graph.createNode('FRAME', editor.state.currentPageId, {
      name: 'Target',
      x: 480,
      y: 80,
      width: 220,
      height: 220
    })
    editor.runLayoutForNode(frame.id)
    editor.select([children[1].id])
    editor.requestRender()
    return {
      frame: frame.id,
      target: target.id,
      children: children.map((child) => child.id),
      page: editor.state.currentPageId
    }
  }, autoLayout)
  await canvas.waitForRender()
  const bounds = await page.getByTestId('canvas-element').boundingBox()
  if (!bounds) throw new Error('Canvas bounds unavailable')
  const point = (x: number, y: number) => ({ x: bounds.x + x, y: bounds.y + y })
  return {
    ids,
    canvas,
    point,
    async select(nodeIds: string[]) {
      await page.evaluate((ids) => window.openPencil?.getStore?.().select(ids), nodeIds)
    },
    async read() {
      return page.evaluate(() => {
        const editor = window.openPencil?.getStore?.()
        if (!editor) throw new Error('Editor unavailable')
        return {
          nodes: [...editor.graph.nodes.values()].map((node) => ({
            id: node.id,
            name: node.name,
            parentId: node.parentId,
            x: node.x,
            y: node.y,
            width: node.width,
            height: node.height,
            childIds: [...node.childIds]
          })),
          selected: [...editor.state.selectedIds],
          dropTarget: editor.state.dropTargetId,
          canUndo: editor.undo.canUndo
        }
      })
    },
    async drag(fromX: number, fromY: number, toX: number, toY: number) {
      const from = point(fromX, fromY)
      const to = point(toX, toY)
      await page.mouse.move(from.x, from.y)
      await page.mouse.down()
      await page.mouse.move(to.x, to.y, { steps: 12 })
      await page.mouse.up()
    }
  }
}
