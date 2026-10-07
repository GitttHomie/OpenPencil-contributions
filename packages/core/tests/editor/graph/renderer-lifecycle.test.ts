import { expect, test } from 'bun:test'

import type { SkiaRenderer } from '@open-pencil/core/canvas'
import { createEditor } from '@open-pencil/core/editor'

import { getTextMeasurer, installTextMeasurer } from '#core/layout/text-measurement'

test('removing the measuring renderer transfers measurement to the surviving renderer', () => {
  const editor = createEditor()
  const baseline = () => ({ width: 0, height: 0 })
  const releaseBaseline = installTextMeasurer(baseline)
  const first: Partial<SkiaRenderer> = {
    measureTextNode: () => ({ width: 10, height: 20 })
  }
  const second: Partial<SkiaRenderer> = {
    measureTextNode: () => ({ width: 30, height: 40 })
  }
  const ck = {} as Parameters<typeof editor.setCanvasKit>[0]
  const node = editor.graph.createNode('TEXT', editor.state.currentPageId)
  try {
    editor.setCanvasKit(ck, first as SkiaRenderer)
    editor.setCanvasKit(ck, second as SkiaRenderer)
    expect(getTextMeasurer()?.(node)).toEqual({ width: 30, height: 40 })

    editor.removeCanvasRenderer(second as SkiaRenderer)
    expect(getTextMeasurer()?.(node)).toEqual({ width: 10, height: 20 })
    editor.removeCanvasRenderer(first as SkiaRenderer)
    expect(getTextMeasurer()).toBe(baseline)
  } finally {
    editor.dispose()
    releaseBaseline()
  }
})
