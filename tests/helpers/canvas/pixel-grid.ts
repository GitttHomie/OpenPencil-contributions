import type { Page } from '@playwright/test'

export async function createPixelGridFixture(page: Page) {
  return page.evaluate(() => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Editor unavailable')
    editor.select([])
    const node = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, {
      name: 'Pixel grid sample',
      x: 2,
      y: 2,
      width: 22,
      height: 16,
      fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.2, b: 0.4, a: 1 }, opacity: 1, visible: true }]
    })
    editor.state.pageColor = { r: 0.95, g: 0.95, b: 0.95, a: 1 }
    editor.requestRender()
    return node.id
  })
}

export async function setPixelGridViewport(page: Page, zoom: number, panX = 24, panY = 16) {
  await page.evaluate(
    ({ zoom, panX, panY }) => {
      const editor = window.openPencil?.getStore?.()
      if (!editor) throw new Error('Editor unavailable')
      editor.state.zoom = zoom
      editor.state.panX = panX
      editor.state.panY = panY
      editor.requestRepaint()
    },
    { zoom, panX, panY }
  )
}

export async function readPixelGridState(page: Page) {
  return page.evaluate(() => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Editor unavailable')
    return {
      visible: editor.state.showPixelGrid,
      snapping: editor.state.snappingPreferences.pixelGrid
    }
  })
}

export async function exportPixelGridSample(page: Page, id: string) {
  return page.evaluate(async (id) => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Editor unavailable')
    const image = await editor.renderExportImage([id], 1, 'PNG')
    if (!image) throw new Error('Export unavailable')
    return Array.from(image)
  }, id)
}
