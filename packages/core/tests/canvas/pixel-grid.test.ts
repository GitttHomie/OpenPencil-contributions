import { expect, test } from 'bun:test'

import { pixelGridLines } from '#core/canvas/pixel-grid'
import { createEditor } from '#core/editor'
import { copyEditorViewState, pickEditorViewState } from '#core/editor/state/view'

test('pixel boundaries follow positive and negative pans at integer and fractional zoom', () => {
  expect(pixelGridLines(0, 8, 24, 1)).toEqual([0, 8, 16, 24])
  expect(pixelGridLines(10, 8, 24, 1)).toEqual([2, 10, 18])
  expect(pixelGridLines(-10, 8, 24, 1)).toEqual([6, 14, 22])
  expect(pixelGridLines(0.3, 8.25, 24, 2)).toEqual([0.5, 8.5, 17])
  expect(pixelGridLines(-100000, 16, 32, 2)).toEqual([0, 16, 32])
})

test('the grid disappears below inspection zoom and rejects invalid viewports', () => {
  expect(pixelGridLines(0, 3.99, 100, 2)).toEqual([])
  expect(pixelGridLines(0, 4, 24, 2)).toEqual([0, 4, 8, 12, 16, 20, 24])
  expect(pixelGridLines(0, 8, 0, 2)).toEqual([])
  expect(pixelGridLines(0, 8, 100, 0)).toEqual([])
  expect(pixelGridLines(Infinity, 8, 100, 2)).toEqual([])
  expect(pixelGridLines(0, 8, Infinity, 2)).toEqual([])
})

test('visibility is view state: it repaints without mutating the document or undo history', () => {
  const editor = createEditor()
  try {
    const before = structuredClone([...editor.graph.nodes])
    const version = editor.state.sceneVersion
    const repaint = editor.state.renderVersion
    expect(editor.state.showPixelGrid).toBe(false)
    editor.setPixelGridVisible(true)
    expect(editor.state.showPixelGrid).toBe(true)
    expect(editor.state.renderVersion).toBeGreaterThan(repaint)
    const after = editor.state.renderVersion
    editor.setPixelGridVisible(true)
    expect(editor.state.renderVersion).toBe(after)
    expect(copyEditorViewState(pickEditorViewState(editor.state)).showPixelGrid).toBe(true)
    editor.setPixelGridVisible(false)
    expect(editor.state.sceneVersion).toBe(version)
    expect([...editor.graph.nodes]).toEqual(before)
    expect(editor.undo.canUndo).toBe(false)
  } finally {
    editor.dispose()
  }
})
