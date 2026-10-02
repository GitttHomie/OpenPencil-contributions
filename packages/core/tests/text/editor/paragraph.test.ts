import { beforeAll, expect, test } from 'bun:test'

import type { CanvasKit } from 'canvaskit-wasm'

import { initCanvasKit } from '@open-pencil/core/io'
import type { SceneNode } from '@open-pencil/scene-graph'
import { createDefaultNode } from '@open-pencil/scene-graph/node-defaults'

import type { SkiaRenderer } from '#core/canvas/renderer'
import { buildParagraph } from '#core/canvas/text'
import { TextEditor } from '#core/text/editor'
import { fontManager } from '#core/text/fonts'

let ck: CanvasKit
let font: ArrayBuffer
beforeAll(async () => {
  ck = await initCanvasKit()
  const data = await fontManager.fetchBundledFont('/Inter-Regular.ttf')
  if (!data) throw new Error('Missing bundled font')
  font = data
})

test('text selection matches painted line spacing and refreshes after typography changes', () => {
  const provider = ck.TypefaceFontProvider.Make()
  provider.registerFont(font, 'Inter')
  const renderer = {
    ck,
    fontProvider: provider,
    fontGeneration: 1,
    buildParagraph(node: SceneNode, color?: Float32Array, options?: { halfLeading?: boolean }) {
      return buildParagraph(renderer as SkiaRenderer, node, color, options)
    }
  }
  const editor = new TextEditor(ck)
  editor.setRenderer(renderer as SkiaRenderer)
  const node = createDefaultNode(() => 'selection', 'TEXT', {
    text: 'Spacing\nMatches',
    fontFamily: 'Inter',
    fontSize: 32,
    lineHeight: 64,
    width: 300,
    height: 240,
    textAlignVertical: 'CENTER'
  })
  try {
    editor.start(node)
    editor.selectAll()
    const check = () => {
      const painted = buildParagraph(renderer as SkiaRenderer, node, undefined, {
        halfLeading: true
      })
      try {
        const offset = Math.max(0, (node.height - painted.getHeight()) / 2)
        const expected = painted
          .getRectsForRange(0, node.text.length, ck.RectHeightStyle.Max, ck.RectWidthStyle.Tight)
          .map(({ rect: [left, top, right, bottom] }) => ({
            x: left,
            y: top + offset,
            width: right - left,
            height: bottom - top
          }))
        expect(editor.getSelectionRects()).toEqual(expected)
      } finally {
        painted.delete()
      }
    }
    check()
    const original = editor.state?.paragraph
    node.fontSize = 44
    node.lineHeight = 72
    check()
    expect(editor.state?.paragraph).not.toBe(original)
    expect(editor.getSelectedText()).toBe(node.text)
  } finally {
    editor.stop()
    provider.delete()
  }
})
