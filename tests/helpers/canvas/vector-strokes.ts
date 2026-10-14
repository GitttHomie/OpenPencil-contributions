import type { Page } from '@playwright/test'

/** Thin measurement endpoints and a Fill shaft must retain their authored stroke widths. */
export async function createStretchingAnnotation(page: Page) {
  return page.evaluate(() => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('OpenPencil store not initialized')
    const root = editor.graph.createNode('FRAME', editor.state.currentPageId, {
      x: 80,
      y: 80,
      width: 320,
      height: 120,
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED',
      counterAxisAlign: 'CENTER',
      clipsContent: false,
      fills: []
    })
    for (const [index, width] of [0.000000685453463, 5.5, 0.000000685453463].entries()) {
      editor.graph.createNode('VECTOR', root.id, {
        name: index === 1 ? 'Shaft' : 'Endpoint',
        layoutGrow: index === 1 ? 1 : 0,
        layoutAlignSelf: index === 1 ? 'AUTO' : 'STRETCH',
        vectorNetwork: {
          vertices: [
            { x: width, y: 0 },
            { x: width, y: index === 1 ? 0 : 7 },
            { x: 0, y: index === 1 ? 0 : 14 }
          ],
          segments: [
            { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
            { start: 1, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
          ],
          regions: []
        },
        fills: [],
        strokes: [
          {
            type: 'SOLID',
            color: { r: 1, g: 0.33, b: 0.29, a: 1 },
            weight: 1,
            opacity: 1,
            visible: true,
            align: 'CENTER'
          }
        ]
      })
    }
    for (const width of [640, 160, 320]) {
      editor.updateNode(root.id, { width })
      editor.runLayoutForNode(root.id)
    }
    editor.clearSelection()
    editor.requestRender()
    return editor.graph.getChildren(root.id).map((node) => node.strokes[0]?.weight)
  })
}
