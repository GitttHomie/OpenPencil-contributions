import type { Page } from '@playwright/test'

import { CanvasHelper } from './canvas'

export async function createClipboardPlacementScene(page: Page) {
  await page.goto('/?test&no-rulers')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  const fixture = await page.evaluate(async () => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Editor unavailable')
    editor.state.zoom = 0.75
    editor.state.panX = -20
    editor.state.panY = 15
    const outer = editor.graph.createNode('FRAME', editor.state.currentPageId, {
      name: 'Outer',
      x: 100,
      y: 80,
      width: 550,
      height: 420,
      fills: [
        { type: 'SOLID', color: { r: 0.87, g: 0.9, b: 0.95, a: 1 }, opacity: 1, visible: true }
      ]
    })
    const target = editor.graph.createNode('FRAME', outer.id, {
      name: 'Paste destination',
      x: 110,
      y: 80,
      width: 300,
      height: 220,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]
    })
    const source = editor.graph.createNode('FRAME', editor.state.currentPageId, {
      name: 'Copied frame',
      x: 1800,
      y: 1500,
      width: 80,
      height: 60,
      fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.4, b: 0.8, a: 1 }, opacity: 1, visible: true }]
    })
    editor.graph.createNode('RECTANGLE', source.id, {
      x: 7,
      y: 11,
      width: 30,
      height: 20,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0.7, b: 0.3, a: 1 }, opacity: 1, visible: true }]
    })
    editor.select([source.id])
    const payload = await editor.prepareCopy()
    editor.select([target.id])
    editor.requestRender()
    return { html: payload.html, target: target.id }
  })
  return {
    canvas,
    async paste() {
      await page.evaluate((html) => {
        const clipboardData = new DataTransfer()
        clipboardData.setData('text/html', html)
        window.dispatchEvent(
          new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true })
        )
      }, fixture.html)
    },
    async read() {
      return page.evaluate((targetId) => {
        const editor = window.openPencil?.getStore?.()
        if (!editor) throw new Error('Editor unavailable')
        return editor.graph.getChildren(targetId).map((n) => ({
          id: n.id,
          x: n.x,
          y: n.y,
          width: n.width,
          height: n.height,
          children: editor.graph
            .getChildren(n.id)
            .map((c) => ({ x: c.x, y: c.y, width: c.width, height: c.height }))
        }))
      }, fixture.target)
    }
  }
}
