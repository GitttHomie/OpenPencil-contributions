import { expect, test } from 'bun:test'

import { pixelGridVisible } from '#core/canvas/overlays/pixel-grid'
import { createEditor } from '#core/editor'
import { copyEditorViewState, pickEditorViewState } from '#core/editor/state/view'

test('the grid appears at 400% regardless of display density', () => {
  for (const dpr of [1, 2, 3]) {
    expect(pixelGridVisible(3.99, dpr)).toBe(false)
    expect(pixelGridVisible(4, dpr)).toBe(true)
  }
  expect(pixelGridVisible(Infinity, 2)).toBe(false)
  expect(pixelGridVisible(8, 0)).toBe(false)
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
