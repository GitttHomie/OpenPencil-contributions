import { afterAll, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { initCanvasKit } from '@open-pencil/core/io'
import { SceneGraph, computeDescendantVisualBounds } from '@open-pencil/scene-graph'

import { SkiaRenderer } from '#core/canvas/renderer'
import { RenderChunkIndex } from '#core/canvas/renderer/chunks/index'
import { computeRetainedSubtreeBounds } from '#core/canvas/renderer/retained-backing'

const ck = await initCanvasKit()
const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(300, 200)))
afterAll(() => renderer.destroy())

test('invalid imported Boolean geometry cannot empty an otherwise valid retained frame', () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const frame = graph.createNode('FRAME', page.id, {
    x: -1600,
    y: 3300,
    width: 200,
    height: 100,
    clipsContent: true,
    fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
  })
  const invalid = graph.createNode('BOOLEAN_OPERATION', frame.id, {
    name: 'Union',
    x: Number.NaN,
    y: Number.NaN,
    width: Number.NaN,
    height: Number.NaN,
    rotation: Number.NaN
  })
  graph.createNode('RECTANGLE', invalid.id, { width: 10, height: 10 })
  const expected = { minX: -1600, minY: 3300, maxX: -1400, maxY: 3400 }
  expect(
    computeDescendantVisualBounds(
      [frame.id],
      (id) => graph.getNode(id),
      (id) => graph.getAbsolutePosition(id)
    )
  ).toEqual(expected)
  expect(computeRetainedSubtreeBounds(graph, frame.id)).toEqual(expected)
  const { index: chunks } = RenderChunkIndex.build(graph, page.id)
  expect(chunks.search(expected).length).toBeGreaterThan(0)
  chunks.dispose()

  renderer.pageId = page.id
  renderer.viewportWidth = 300
  renderer.viewportHeight = 200
  renderer.panX = 1650
  renderer.panY = -3250
  renderer.render(graph, new Set(), {}, 1, 'scene')
  renderer.sceneBackingPreviewUntil = 0
  renderer.render(graph, new Set(), {}, 1, 'scene')
  const image = renderer.surface.makeImageSnapshot()
  try {
    const pixels = expectDefined(
      image.readPixels(100, 100, {
        width: 1,
        height: 1,
        colorType: ck.ColorType.RGBA_8888,
        alphaType: ck.AlphaType.Unpremul,
        colorSpace: ck.ColorSpace.SRGB
      })
    )
    expect([...pixels]).toEqual([255, 0, 0, 255])
    expect(Number.isNaN(invalid.width)).toBe(true)
  } finally {
    image.delete()
  }
})
