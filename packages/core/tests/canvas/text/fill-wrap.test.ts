import { beforeAll, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'
import type { CanvasKit } from 'canvaskit-wasm'

import type { SceneNode } from '@open-pencil/scene-graph'

import { buildParagraph, measureTextNode, withTextParagraph } from '#core/canvas/text'
import type { ParagraphBuildOptions } from '#core/canvas/text'
import { TextPreparationCache } from '#core/canvas/text/preparation/cache'
import { getCanvasKit } from '#core/canvaskit'
import { createEditor } from '#core/editor/create'
import { computeAllLayouts, installTextMeasurer } from '#core/layout'
import { fontManager } from '#core/text/fonts'

let ck: CanvasKit
let font: ArrayBuffer
beforeAll(async () => {
  ck = await getCanvasKit()
  font = await Bun.file('packages/core/assets/Inter-Regular.ttf').arrayBuffer()
})

test('Fill text draws the same wrapped lines as layout while intrinsic Hug measurement stays unbounded', () => {
  const editor = createEditor()
  const graph = editor.graph
  const fontProvider = ck.TypefaceFontProvider.Make()
  const textPreparationCache = new TextPreparationCache()
  fontManager.attachProvider(ck, fontProvider)
  fontManager.markLoaded('Inter', 'Regular', font)
  const renderer = {
    ck,
    fontProvider,
    fontsLoaded: true,
    textPreparationCache,
    buildParagraph(node: SceneNode, color: Float32Array, options: ParagraphBuildOptions) {
      return buildParagraph(this, node, color, options)
    }
  }
  const removeMeasurer = installTextMeasurer((node, width) =>
    measureTextNode(renderer, node, width)
  )
  const paint = new ck.Paint()
  paint.setColor(ck.BLACK)
  try {
    const main = graph.createNode('COMPONENT', editor.state.currentPageId, {
      width: 269,
      layoutMode: 'VERTICAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'FIXED'
    })
    const label = graph.createNode('TEXT', main.id, {
      name: 'Label',
      text: 'A sentence long enough that it has to wrap automatically when the frame gets narrower.',
      fontFamily: 'Inter',
      fontSize: 16,
      lineHeight: 24,
      textAutoResize: 'WIDTH_AND_HEIGHT',
      layoutAlignSelf: 'STRETCH'
    })
    const instance = expectDefined(graph.createInstance(main.id, editor.state.currentPageId))
    const copy = expectDefined(graph.getChildren(instance.id)[0])
    computeAllLayouts(graph)
    const intrinsic = expectDefined(measureTextNode(renderer, label))
    expect(intrinsic.width).toBeGreaterThan(label.width)
    expect(intrinsic.height).toBe(24)
    const read = (node: SceneNode, options: ParagraphBuildOptions = {}) =>
      withTextParagraph(
        renderer,
        node,
        ck.BLACK,
        { halfLeading: true, ...options },
        (paragraph) => ({
          height: paragraph.getHeight(),
          lines: paragraph.getLineMetrics().length,
          width: paragraph.getLongestLine()
        })
      )
    for (const node of [label, copy]) {
      const drawn = read(node)
      expect(drawn.lines).toBeGreaterThan(1)
      expect(drawn.height).toBe(node.height)
      expect(drawn.width).toBeLessThanOrEqual(node.width)
      expect(read(node, { foregroundPaint: paint })).toEqual(drawn)
      expect(node.textAutoResize).toBe('WIDTH_AND_HEIGHT')
    }
    const initial = read(copy)
    const previousParagraphDisposed = withTextParagraph(
      renderer,
      copy,
      ck.BLACK,
      { halfLeading: true },
      (paragraph) => () => paragraph.isDeleted()
    )
    editor.updateNodeWithUndo(instance.id, { width: 160 })
    const narrow = read(copy)
    expect(previousParagraphDisposed()).toBe(true)
    expect(narrow.lines).toBeGreaterThan(initial.lines)
    expect(narrow.height).toBe(copy.height)
    expect(narrow.width).toBeLessThanOrEqual(160)
    editor.undo.undo()
    expect(read(copy)).toEqual(initial)
    editor.undo.redo()
    expect(read(copy)).toEqual(narrow)
    editor.updateNodeWithUndo(copy.id, { text: 'Short label' })
    expect(read(copy).lines).toBe(1)
    expect(copy.height).toBe(24)
    editor.undo.undo()
    expect(read(copy)).toEqual(narrow)
  } finally {
    removeMeasurer()
    editor.dispose()
    textPreparationCache.clear()
    paint.delete()
    fontManager.detachProvider(fontProvider)
    fontProvider.delete()
  }
})
