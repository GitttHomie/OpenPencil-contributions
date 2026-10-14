import type { Page } from '@playwright/test'

import type * as VectorModule from '@open-pencil/scene-graph/vector-network'

/** Imported borders retain a 100×48 outline while the live button changes size and corners. */
export async function createImportedStrokeButtons(page: Page) {
  return page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const path = '/packages/scene-graph/src/vector/index.ts'
    const { regenerateFillGeometry } = (await import(path)) as typeof VectorModule
    const vertices = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 48 },
      { x: 0, y: 48 },
      { x: 2, y: 2 },
      { x: 98, y: 2 },
      { x: 98, y: 46 },
      { x: 2, y: 46 }
    ]
    const strokeGeometry = regenerateFillGeometry(
      {
        vertices,
        segments: vertices.map((_, index) => ({
          start: index,
          end: index % 4 === 3 ? index - 3 : index + 1,
          tangentStart: { x: 0, y: 0 },
          tangentEnd: { x: 0, y: 0 }
        })),
        regions: [
          {
            windingRule: 'EVENODD',
            loops: [
              [0, 1, 2, 3],
              [4, 5, 6, 7]
            ]
          }
        ]
      },
      [{ windingRule: 'EVENODD', commandsBlob: new Uint8Array() }]
    )
    const ids: string[] = []
    const types = ['FRAME', 'COMPONENT', 'INSTANCE', 'RECTANGLE'] as const
    for (const [column, type] of types.entries()) {
      for (const [row, width] of [180, 60].entries()) {
        const node = store.graph.createNode(type, store.state.currentPageId, {
          x: 40 + column * 220,
          y: 50 + row * 110,
          width,
          height: row === 0 ? 64 : 36,
          cornerRadius: 16,
          cornerSmoothing: column % 2 === 0 ? 0 : 0.6,
          fills: [],
          strokes: [
            {
              type: 'SOLID',
              color: { r: 0.2, g: 0.55, b: 0.95, a: 1 },
              weight: 4,
              opacity: 1,
              visible: true,
              align: 'INSIDE'
            }
          ],
          strokeGeometry: structuredClone(strokeGeometry)
        })
        ids.push(node.id)
      }
    }
    store.clearSelection()
    store.requestRender()
    return ids
  })
}

/** The same editable shapes without saved outlines are the rendering reference. */
export async function clearImportedStrokeOutlines(page: Page, ids: string[]) {
  await page.evaluate((nodeIds) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    for (const id of nodeIds) store.graph.updateNode(id, { strokeGeometry: [] })
    store.requestRender()
  }, ids)
}
