import { expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import type { Fill } from '@open-pencil/scene-graph'

import { createGradientEditing } from '@/app/editor/gradient/editing'

const gradient: Fill = {
  type: 'GRADIENT_LINEAR',
  color: { r: 0, g: 0, b: 0, a: 1 },
  visible: true,
  opacity: 1,
  gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
  gradientStops: [
    { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
    { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } }
  ]
}

test('drag previews are live, retain other fills and geometry, and commit as one undo step', () => {
  const editor = createEditor()
  try {
    const node = editor.graph.createNode('FRAME', editor.state.currentPageId, {
      x: 50,
      y: 80,
      width: 200,
      height: 100,
      fills: [
        { type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, visible: true, opacity: 1 },
        structuredClone(gradient)
      ]
    })
    let flushed = 0
    const editing = createGradientEditing(editor, { nodeId: node.id, fillIndex: 1 }, () => {
      flushed++
    })
    expect(editing.begin('start', { x: 200, y: 0 })).toBe(true)
    editing.move({ x: 140, y: 40 })
    expect(node.fills[1].gradientTransform?.m00).toBe(0.7)
    editing.move({ x: 100, y: 80 })
    editing.commit()
    expect(flushed).toBe(1)
    expect(node.fills[0].type).toBe('SOLID')
    expect(node.x).toBe(50)
    expect(node.y).toBe(80)
    expect(node.fills[1].gradientTransform?.m10).toBe(0.8)
    editor.undoAction()
    expect(node.fills[1]).toEqual(gradient)
    editor.redoAction()
    expect(node.fills[1].gradientTransform?.m10).toBe(0.8)
  } finally {
    editor.dispose()
  }
})

test('cancelling a drag restores the original fill and ignores trailing pointer moves', () => {
  const editor = createEditor()
  try {
    const node = editor.graph.createNode('FRAME', editor.state.currentPageId, {
      width: 200,
      height: 100,
      fills: [structuredClone(gradient)]
    })
    const editing = createGradientEditing(
      editor,
      { nodeId: node.id, fillIndex: 0 },
      () => undefined
    )
    editing.begin('center', { x: 102, y: 2 })
    editing.move({ x: 142, y: 22 })
    expect(node.fills[0].gradientTransform?.m02).toBe(0.2)
    editing.cancel()
    editing.move({ x: 500, y: 500 })
    editing.commit()
    expect(node.fills).toEqual([gradient])
  } finally {
    editor.dispose()
  }
})
