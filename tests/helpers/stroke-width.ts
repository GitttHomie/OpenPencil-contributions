import type { Page } from '@playwright/test'

import { CanvasHelper } from './canvas'

export async function createStrokeWidthScene(page: Page, rounded = false) {
  await page.goto('/?test&no-rulers')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  const ids = await page.evaluate((rounded) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    store.state.panX = 0
    store.state.panY = 0
    store.state.zoom = 1
    const nodes = [false, true].map((independent, index) =>
      store.graph.createNode('FRAME', store.state.currentPageId, {
        name: independent ? 'Independent border' : 'Uniform border',
        x: 80 + index * 240,
        y: 100,
        width: 180,
        height: 120,
        cornerRadius: rounded && index === 0 ? 24 : 0,
        cornerSmoothing: rounded && index === 0 ? 0.6 : 0,
        strokes: [
          {
            type: 'SOLID',
            color: { r: 0, g: 0, b: 0, a: 1 },
            opacity: 1,
            visible: true,
            weight: 2,
            align: 'INSIDE'
          }
        ],
        independentStrokeWeights: independent,
        borderTopWeight: independent ? 3 : 0,
        borderRightWeight: independent ? 4 : 0,
        borderBottomWeight: independent ? 5 : 0,
        borderLeftWeight: independent ? 6 : 0
      })
    )
    nodes.push(
      store.graph.createNode('LINE', store.state.currentPageId, {
        name: 'Line stroke',
        x: 100,
        y: 300,
        width: 180,
        height: 0,
        strokes: [{ ...nodes[0].strokes[0] }]
      })
    )
    store.select([nodes[0].id])
    store.requestRender()
    return nodes.map((node) => node.id)
  }, rounded)
  return {
    canvas,
    async select(index: number) {
      await page.evaluate((id) => window.openPencil?.getStore?.().select([id]), ids[index])
      await page.getByTestId('canvas-element').focus()
    },
    async read(index: number) {
      return page.evaluate((id) => {
        const node = window.openPencil?.getStore?.().graph.getNode(id)
        if (!node) throw new Error('Stroke node unavailable')
        return {
          weight: node.strokes[0]?.weight,
          independent: node.independentStrokeWeights,
          top: node.borderTopWeight,
          right: node.borderRightWeight,
          bottom: node.borderBottomWeight,
          left: node.borderLeftWeight
        }
      }, ids[index])
    }
  }
}
