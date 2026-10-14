import type { Page } from '@playwright/test'

export async function createPixelSnappingFixture(page: Page) {
  return page.evaluate(() => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Editor unavailable')
    const node = editor.graph.createNode('FRAME', editor.state.currentPageId, {
      name: 'Pixel snapping',
      x: 2,
      y: 2,
      width: 22,
      height: 16,
      fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.2, b: 0.4, a: 1 }, opacity: 1, visible: true }]
    })
    editor.state.snappingPreferences = { geometry: false, objects: false, pixelGrid: true }
    editor.state.pageColor = { r: 0.95, g: 0.95, b: 0.95, a: 1 }
    editor.setPixelGridVisible(true)
    editor.select([node.id])
    editor.requestRender()
    return node.id
  })
}

export async function readPixelSnappingGeometry(page: Page, id: string) {
  return page.evaluate((id) => {
    const node = window.openPencil?.getStore?.().graph.getNode(id)
    if (!node) throw new Error('Pixel snapping fixture unavailable')
    return { x: node.x, y: node.y, width: node.width, height: node.height }
  }, id)
}
