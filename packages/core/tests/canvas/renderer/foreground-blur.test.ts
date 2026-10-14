import { afterEach, describe, expect, spyOn, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { initCanvasKit } from '@open-pencil/core/io'
import { SceneGraph, type Effect } from '@open-pencil/scene-graph'

import { SkiaRenderer, type RenderOverlays } from '#core/canvas/renderer'

const ck = await initCanvasKit()
const renderers: SkiaRenderer[] = []
afterEach(() => {
  for (const renderer of renderers) renderer.destroy()
  renderers.length = 0
})

function fixture() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const blur: Effect = {
    type: 'FOREGROUND_BLUR',
    radius: 16,
    spread: 0,
    offset: { x: 0, y: 0 },
    color: { r: 0, g: 0, b: 0, a: 1 },
    visible: true,
    blendMode: 'NORMAL'
  }
  const node = graph.createNode('ELLIPSE', page.id, {
    x: 80,
    y: 80,
    width: 64,
    height: 64,
    fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }],
    effects: [blur]
  })
  const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(256, 256)))
  renderers.push(renderer)
  renderer.pageId = page.id
  renderer.viewportWidth = 256
  renderer.viewportHeight = 256
  renderer.worldViewport = { x: 0, y: 0, w: 256, h: 256 }
  renderer.renderingSceneBacking = true
  const canvas = renderer.surface.getCanvas()
  const draw = (overlays: RenderOverlays = {}) => {
    canvas.clear(ck.TRANSPARENT)
    renderer.renderNode(canvas, graph, node.id, overlays)
    renderer.surface.flush()
  }
  return { graph, node, renderer, draw, blur }
}

describe('foreground blur previews', () => {
  test('reuses a blurred shape while its position changes', () => {
    const { graph, node, renderer, draw } = fixture()
    draw()
    const raster = expectDefined(renderer.foregroundBlurCache.peek(node.id)).image
    graph.updateNode(node.id, { x: 100 })
    renderer.invalidateNodePicture(node.id, ['x'])
    draw()
    expect(renderer.foregroundBlurCache.peek(node.id)?.image).toBe(raster)
  })

  test('invalidates appearance and size changes and releases the previous image', () => {
    const { graph, node, renderer, draw } = fixture()
    draw()
    const image = expectDefined(renderer.foregroundBlurCache.peek(node.id)).image
    graph.updateNode(node.id, { width: 90 })
    renderer.invalidateNodePicture(node.id, ['width'])
    expect(renderer.foregroundBlurCache.has(node.id)).toBe(false)
    expect(image.isDeleted()).toBe(true)
    draw()
    expect(renderer.foregroundBlurCache.peek(node.id)?.image).not.toBe(image)
    renderer.invalidateNodePicture(node.id, ['fills'])
    expect(renderer.foregroundBlurCache.has(node.id)).toBe(false)
  })

  test('reuses nearby zoom scales and rebuilds for a larger scale', () => {
    const { node, renderer, draw } = fixture()
    draw()
    const first = expectDefined(renderer.foregroundBlurCache.peek(node.id)).image
    renderer.zoom = 1.1
    draw()
    expect(renderer.foregroundBlurCache.peek(node.id)?.image).toBe(first)
    renderer.zoom = 2
    draw()
    expect(renderer.foregroundBlurCache.peek(node.id)?.image).not.toBe(first)
    expect(first.isDeleted()).toBe(true)
  })

  test('settled drawing bypasses preview rasters', () => {
    const { renderer, draw } = fixture()
    draw()
    const filter = spyOn(renderer, 'getCachedBlur')
    try {
      draw()
      expect(filter).not.toHaveBeenCalled()
      renderer.renderingSceneBacking = false
      draw()
      expect(filter).toHaveBeenCalledTimes(1)
    } finally {
      filter.mockRestore()
    }
  })

  test('size previews cannot reuse an image of the old size or allocate during the gesture', () => {
    const { graph, node, renderer, draw } = fixture()
    draw()
    const image = expectDefined(renderer.foregroundBlurCache.peek(node.id)).image
    graph.updateNode(node.id, { width: 100 })
    // Geometry previews can retain node pictures until commit.
    draw({ transforming: true })
    expect(image.isDeleted()).toBe(true)
    expect(renderer.foregroundBlurCache.size).toBe(0)
    draw()
    expect(renderer.foregroundBlurCache.size).toBe(1)
  })

  test('rotation previews use the current transform instead of the unrotated raster', () => {
    const { node, renderer, draw } = fixture()
    draw()
    const filter = spyOn(renderer, 'getCachedBlur')
    try {
      draw({ transforming: true, rotationPreview: { nodeId: node.id, angle: 45 } })
      expect(filter).toHaveBeenCalledTimes(1)
    } finally {
      filter.mockRestore()
    }
  })

  test('does not cache background-dependent effects or containers', () => {
    const { graph, node, renderer, draw, blur } = fixture()
    graph.updateNode(node.id, { effects: [blur, { ...blur, type: 'BACKGROUND_BLUR' }] })
    draw()
    expect(renderer.foregroundBlurCache.size).toBe(0)
    graph.updateNode(node.id, { effects: [blur] })
    graph.createNode('RECTANGLE', node.id, { width: 20, height: 20 })
    draw()
    expect(renderer.foregroundBlurCache.size).toBe(0)
  })

  test('oversized rasters fall back without allocating a cache entry', () => {
    const { graph, node, renderer, draw } = fixture()
    graph.updateNode(node.id, { width: 2000, height: 2000 })
    renderer.zoom = 4
    draw()
    expect(renderer.foregroundBlurCache.size).toBe(0)
  })

  test('clearing the renderer releases cached blur images', () => {
    const { node, renderer, draw } = fixture()
    draw()
    const image = expectDefined(renderer.foregroundBlurCache.peek(node.id)).image
    renderer.invalidateAllPictures()
    expect(image.isDeleted()).toBe(true)
    expect(renderer.foregroundBlurCache.size).toBe(0)
  })
})
