import { expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'

import { handleDrawMove, startShapeDraw } from '#vue/shared/input/draw'
import { cancelMove, handleMoveMove, handleMoveUp } from '#vue/shared/input/move'
import { applyResize, commitResizePreview } from '#vue/shared/input/resize'
import { createSelectionMoveDrag } from '#vue/shared/input/select/move'
import { resolveObjectPixelSnap } from '#vue/shared/input/snap'
import type { DragResize, DragState } from '#vue/shared/input/types'

test('pixel snapping remains hard at high zoom and removes fractional target guides', () => {
  const editor = createEditor()
  try {
    editor.state.zoom = 64
    editor.state.snappingPreferences.objects = false
    const bounds = { x: 10.4, y: -20.4, width: 20, height: 20 }
    const result = resolveObjectPixelSnap(new Set(), bounds, [], editor)
    expect(bounds.x + result.correction.x).toBe(10)
    expect(bounds.y + result.correction.y).toBe(-20)
    editor.state.zoom = 1
    const fractional = resolveObjectPixelSnap(new Set(), bounds, [], editor, [
      { kind: 'canvas-guide', axis: 'x', position: 11.25, from: 0, to: 100 }
    ])
    expect(bounds.x + fractional.correction.x).toBe(11)
    expect(fractional.guides).toEqual([])
  } finally {
    editor.dispose()
  }
})

test('multi-object movement rounds each position, including Control, with exact cancel and undo', () => {
  const editor = createEditor()
  try {
    editor.state.zoom = 64
    const first = editor.graph.createNode('FRAME', editor.state.currentPageId, {
      x: 10.2,
      y: 20.7,
      width: 20,
      height: 20
    })
    const second = editor.graph.createNode('FRAME', editor.state.currentPageId, {
      x: 50.7,
      y: 60.2,
      width: 20,
      height: 20
    })
    editor.select([first.id, second.id])
    for (const cancel of [true, false]) {
      const drag = createSelectionMoveDrag(0, 0, 0, 0, editor, false)
      if (drag.type !== 'move') throw new Error('Expected move')
      handleMoveMove(drag, 3.4, -2.3, 100, 100, editor, true)
      expect([first.x, first.y, second.x, second.y]).toEqual([14, 18, 54, 58])
      if (cancel) cancelMove(drag, editor)
      else {
        handleMoveUp(drag, editor)
        editor.undoAction()
      }
      expect([first.x, first.y, second.x, second.y]).toEqual([10.2, 20.7, 50.7, 60.2])
    }
    editor.redoAction()
    expect([first.x, first.y, second.x, second.y]).toEqual([14, 18, 54, 58])
  } finally {
    editor.dispose()
  }
})

test('drawing at high zoom rounds the live preview and preserves one-step creation undo', () => {
  const editor = createEditor()
  try {
    editor.state.zoom = 64
    editor.setTool('FRAME')
    let drag: DragState | undefined
    startShapeDraw(10.2, 20.7, editor, (value) => {
      drag = value
    })
    if (drag?.type !== 'draw') throw new Error('Expected draw')
    handleDrawMove(drag, 33.6, 52.4, false)
    expect(editor.graph.getNode(drag.nodeId)).toMatchObject({ x: 10, y: 21, width: 24, height: 31 })
    drag.commit()
    expect(editor.graph.getNode(drag.nodeId)).toMatchObject({ x: 10, y: 21, width: 24, height: 31 })
    editor.undoAction()
    expect(editor.graph.getNode(drag.nodeId)).toBeUndefined()
  } finally {
    editor.dispose()
  }
})

test('constrained resize rounds the live box at high zoom and undo restores decimals', () => {
  const editor = createEditor()
  try {
    editor.state.zoom = 64
    const node = editor.graph.createNode('FRAME', editor.state.currentPageId, {
      x: 10.2,
      y: 20.7,
      width: 100.4,
      height: 80.3
    })
    const origRect = { x: node.x, y: node.y, width: node.width, height: node.height }
    const drag: DragResize = {
      type: 'resize',
      handle: 'se',
      startX: 110.6,
      startY: 101,
      nodeId: node.id,
      origRect,
      origVectorNetwork: null,
      origFillGeometry: [],
      origStrokeGeometry: [],
      origDerivedTextGlyphs: null,
      origStrokes: [],
      origTextPathData: null,
      origTextPathBox: null,
      origChildren: null
    }
    applyResize(drag, 122.37, 113.28, true, editor, true)
    const final = { x: node.x, y: node.y, width: node.width, height: node.height }
    expect(Object.values(final).every(Number.isInteger)).toBe(true)
    commitResizePreview(drag, editor)
    expect(node).toMatchObject(final)
    editor.undoAction()
    expect(node).toMatchObject(origRect)
    editor.redoAction()
    expect(node).toMatchObject(final)
  } finally {
    editor.dispose()
  }
})
