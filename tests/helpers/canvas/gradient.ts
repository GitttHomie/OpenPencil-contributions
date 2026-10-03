import type { Locator, Page } from '@playwright/test'

import type * as Geometry from '@open-pencil/core/geometry'
import type { Fill, Vector } from '@open-pencil/scene-graph'

export async function createGradientFixture(page: Page, type: Fill['type'], transformed = false) {
  return page.evaluate(
    ({ type, transformed }) => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('Editor unavailable')
      store.zoomTo100()
      store.pan(-store.state.panX, -store.state.panY)
      const parent = store.graph.createNode('FRAME', store.state.currentPageId, {
        name: 'Gradient card',
        x: 110,
        y: 100,
        width: 360,
        height: 280,
        rotation: transformed ? 20 : 0,
        flipX: transformed,
        fills: [],
        clipsContent: false
      })
      const node = store.graph.createNode('FRAME', parent.id, {
        name: 'Photo surface',
        x: 50,
        y: 40,
        width: 240,
        height: 180,
        cornerRadius: 20,
        fills: [
          {
            type,
            color: { r: 0, g: 0, b: 0, a: 1 },
            visible: true,
            opacity: 1,
            gradientTransform: {
              m00: 0.8,
              m01: 0,
              m02: 0.1,
              m10: 0,
              m11: 0.8,
              m12: type === 'GRADIENT_LINEAR' ? 0.5 : 0.1
            },
            gradientStops: [
              { position: 0, color: { r: 0.95, g: 0.3, b: 0.4, a: 1 } },
              { position: 1, color: { r: 0.2, g: 0.3, b: 0.9, a: 1 } }
            ]
          }
        ]
      })
      store.select([node.id])
      store.requestRender()
      return { id: node.id, fill: structuredClone(node.fills[0]) }
    },
    { type, transformed }
  )
}

export async function readGradient(page: Page, id: string) {
  return page.evaluate((id) => {
    const node = window.openPencil?.getStore?.().graph.getNode(id)
    if (!node) throw new Error('Gradient frame unavailable')
    return { fill: structuredClone(node.fills[0]), x: node.x, y: node.y }
  }, id)
}

export async function readGradientHandles(page: Page, id: string) {
  return page.evaluate(async (id) => {
    const node = window.openPencil?.getStore?.().graph.getNode(id)
    const fill = node?.fills[0]
    if (!node || !fill?.gradientTransform) throw new Error('Gradient unavailable')
    const path = '/packages/core/src/geometry/index.ts'
    const geometry: typeof Geometry = await import(path)
    return geometry.gradientHandles(fill.type, fill.gradientTransform, node.width, node.height)
  }, id)
}

export async function gradientPointOnScreen(page: Page, id: string, point: Vector) {
  return page.evaluate(
    async ({ id, point }) => {
      const store = window.openPencil?.getStore?.()
      const node = store?.graph.getNode(id)
      const canvas = document.querySelector('[data-test-id="canvas-area"]')?.getBoundingClientRect()
      if (!store || !node || !canvas) throw new Error('Gradient canvas unavailable')
      const path = '/packages/core/src/geometry/index.ts'
      const geometry: typeof Geometry = await import(path)
      const screen = geometry.createSceneGeometry(store.graph).toScreen(node, point, store.state)
      return { x: screen.x + canvas.x, y: screen.y + canvas.y }
    },
    { id, point }
  )
}

export async function beginGradientDrag(page: Page, handle: Locator, destination: Vector) {
  const box = await handle.boundingBox()
  if (!box) throw new Error('Gradient handle unavailable')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(destination.x, destination.y, { steps: 8 })
}
