import type { Page } from '@playwright/test'

import type * as EditorModule from '@open-pencil/core/editor'
import type * as Geometry from '@open-pencil/core/geometry'
import type { GradientHandle } from '@open-pencil/core/geometry'
import type { Fill, Vector, GradientTransform, SceneGraph } from '@open-pencil/scene-graph'

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
              m00: 1.25,
              m01: 0,
              m02: -0.125,
              m10: 0,
              m11: 1.25,
              m12: -0.125
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

export async function gradientHandleOnScreen(page: Page, handle: GradientHandle) {
  return page.evaluate(async (handle) => {
    const store = window.openPencil?.getStore?.()
    const canvas = document.querySelector('[data-test-id="canvas-area"]')?.getBoundingClientRect()
    if (!store || !canvas) throw new Error('Canvas unavailable')
    const path = '/packages/core/src/editor/gradient-edit.ts'
    const module: typeof EditorModule = await import(path)
    const layout = module.editedGradientLayout(store.graph, store.state.gradientEdit, store.state)
    const dot = layout?.dots.find((dot) => dot.handle === handle)
    if (!dot) throw new Error('Gradient handle unavailable')
    return { x: dot.point.x + canvas.x, y: dot.point.y + canvas.y }
  }, handle)
}

export async function gradientGuideCount(page: Page) {
  return page.evaluate(
    () => window.openPencil?.getStore?.().state.gradientEdit?.guides?.length ?? 0
  )
}

export async function beginGradientDrag(page: Page, handle: GradientHandle, destination: Vector) {
  const point = await gradientHandleOnScreen(page, handle)
  await page.mouse.move(point.x, point.y)
  await page.mouse.down()
  await page.mouse.move(destination.x, destination.y, { steps: 8 })
}

type GradientType = 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'GRADIENT_ANGULAR' | 'GRADIENT_DIAMOND'

/**
 * Figma's identity transform for each kind: linear from the left edge's middle to the right's, the
 * others centred and filling the layer.
 */
const IDENTITY: GradientTransform = { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
const TRANSFORMS: Record<GradientType, GradientTransform> = {
  GRADIENT_LINEAR: IDENTITY,
  GRADIENT_RADIAL: IDENTITY,
  GRADIENT_ANGULAR: IDENTITY,
  GRADIENT_DIAMOND: IDENTITY
}

/** A 200 × 140 rectangle at the origin with a red, yellow, and blue gradient fill. */
export function createGradientScene(graph: SceneGraph, pageId: string, type: GradientType) {
  const fill: Fill = {
    type,
    visible: true,
    opacity: 1,
    color: { r: 0, g: 0, b: 0, a: 1 },
    gradientTransform: TRANSFORMS[type],
    gradientStops: [
      { position: 0, color: { r: 1, g: 0.3, b: 0.2, a: 1 } },
      { position: 0.5, color: { r: 1, g: 0.85, b: 0.2, a: 1 } },
      { position: 1, color: { r: 0.2, g: 0.4, b: 1, a: 1 } }
    ]
  }
  const node = graph.createNode('RECTANGLE', pageId, {
    name: 'Gradient',
    x: 0,
    y: 0,
    width: 200,
    height: 140,
    fills: [fill]
  })
  return { nodeId: node.id }
}
