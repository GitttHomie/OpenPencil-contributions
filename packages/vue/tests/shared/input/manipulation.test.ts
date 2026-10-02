import { describe, expect, test } from 'bun:test'

import { createEditor, type Editor } from '@open-pencil/core/editor'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import Matrix from '@open-pencil/scene-graph/matrix'

import { handleDrawMove, startShapeDraw } from '#vue/shared/input/draw'
import { cancelMove, handleMoveMove, handleMoveUp } from '#vue/shared/input/move'
import { createSelectionMoveDrag } from '#vue/shared/input/select/move'
import type { DragState } from '#vue/shared/input/types'

function setup(layoutMode: 'NONE' | 'HORIZONTAL' = 'NONE') {
  const editor = createEditor()
  editor.state.snappingPreferences = { geometry: false, objects: false, pixelGrid: false }
  const frame = editor.graph.createNode('FRAME', editor.state.currentPageId, {
    x: 100,
    y: 100,
    width: 300,
    height: 100,
    layoutMode,
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'FIXED',
    itemSpacing: 10
  })
  const children = ['A', 'B', 'C'].map((name, i) =>
    editor.graph.createNode('RECTANGLE', frame.id, {
      name,
      x: i * 60,
      y: 10,
      width: 50,
      height: 40
    })
  )
  editor.runLayoutForNode(frame.id)
  return { editor, frame, children }
}

function startMove(editor: Editor, x: number, y: number) {
  const drag = createSelectionMoveDrag(x, y, x, y, editor, false)
  if (drag.type !== 'move') throw new Error('Expected move')
  return drag
}

function startDraw(editor: Editor, x: number, y: number) {
  const state: { drag: DragState | null } = { drag: null }
  editor.setTool('FRAME')
  startShapeDraw(x, y, editor, (drag) => {
    state.drag = drag
  })
  if (state.drag?.type !== 'draw') throw new Error('Expected draw')
  return state.drag
}

describe('canvas nesting gestures', () => {
  for (const mode of ['NONE', 'HORIZONTAL'] as const) {
    test(`drag out of ${mode} preserves placement and restores exact sibling order on undo`, () => {
      const {
        editor,
        frame,
        children: [a, b, c]
      } = setup(mode)
      const original = { x: b.x, y: b.y }
      editor.select([b.id])
      const start = { x: frame.x + b.x + 20, y: frame.y + b.y + 20 }
      const drag = startMove(editor, start.x, start.y)
      handleMoveMove(drag, start.x, 250, start.x, 250, editor, true)
      handleMoveUp(drag, editor)
      expect(b.parentId).toBe(editor.state.currentPageId)
      expect(b.x).toBe(frame.x + original.x)
      expect(b.y).toBe(230)
      expect(frame.childIds).toEqual([a.id, c.id])
      editor.undoAction()
      expect(frame.childIds).toEqual([a.id, b.id, c.id])
      expect(b).toMatchObject({ ...original, parentId: frame.id })
      expect(editor.undo.canUndo).toBe(false)
      editor.redoAction()
      expect(b.parentId).toBe(editor.state.currentPageId)
      expect(b.y).toBe(230)
      editor.dispose()
    })
  }

  test('dropping outside multiple ancestors detaches directly to the page', () => {
    const {
      editor,
      frame,
      children: [child]
    } = setup()
    const outer = editor.graph.createNode('FRAME', editor.state.currentPageId, {
      width: 500,
      height: 300
    })
    editor.graph.reparentNode(frame.id, outer.id)
    editor.select([child.id])
    const drag = startMove(editor, 120, 130)
    handleMoveMove(drag, 650, 400, 650, 400, editor, true)
    handleMoveUp(drag, editor)
    expect(child.parentId).toBe(editor.state.currentPageId)
    expect(child).toMatchObject({ x: 630, y: 380 })
    editor.dispose()
  })

  test('multi-selection reorders as a stable block in one undo step', () => {
    const {
      editor,
      frame,
      children: [a, b, c]
    } = setup('HORIZONTAL')
    editor.select([b.id, a.id])
    const drag = startMove(editor, 120, 120)
    handleMoveMove(drag, 380, 120, 380, 120, editor)
    handleMoveUp(drag, editor)
    expect(frame.childIds).toEqual([c.id, a.id, b.id])
    editor.undoAction()
    expect(frame.childIds).toEqual([a.id, b.id, c.id])
    expect(editor.undo.canUndo).toBe(false)
    editor.redoAction()
    expect(frame.childIds).toEqual([c.id, a.id, b.id])
    editor.dispose()
  })

  test('cancel restores preview positions and creates no undo entry', () => {
    const {
      editor,
      children: [child]
    } = setup('HORIZONTAL')
    editor.select([child.id])
    const original = { x: child.x, y: child.y, parentId: child.parentId }
    const drag = startMove(editor, 120, 120)
    handleMoveMove(drag, 600, 300, 600, 300, editor)
    cancelMove(drag, editor)
    expect(child).toMatchObject(original)
    expect(editor.undo.canUndo).toBe(false)
    editor.dispose()
  })

  test('moving a parent and a descendant only moves the parent', () => {
    const {
      editor,
      frame,
      children: [child]
    } = setup()
    editor.select([frame.id, child.id])
    const drag = startMove(editor, 120, 120)
    expect([...drag.originals.keys()]).toEqual([frame.id])
    handleMoveMove(drag, 620, 420, 620, 420, editor, true)
    handleMoveUp(drag, editor)
    expect(frame).toMatchObject({ x: 600, y: 400 })
    expect(child.parentId).toBe(frame.id)
    expect(child).toMatchObject({ x: 0, y: 10 })
    editor.dispose()
  })

  test('drawing inside a frame nests at the visual position and undoes creation in one step', () => {
    const { editor, frame } = setup()
    const drag = startDraw(editor, 150, 150)
    expect(editor.state.dropTargetId).toBe(frame.id)
    handleDrawMove(drag, 230, 190, false)
    drag.commit()
    expect(editor.graph.getNode(drag.nodeId)).toMatchObject({
      parentId: frame.id,
      x: 50,
      y: 50,
      width: 80,
      height: 40
    })
    editor.undoAction()
    expect(editor.graph.getNode(drag.nodeId)).toBeUndefined()
    expect(editor.undo.canUndo).toBe(false)
    editor.redoAction()
    expect(editor.graph.getNode(drag.nodeId)).toMatchObject({ parentId: frame.id, x: 50, y: 50 })
    editor.dispose()
  })

  test('drawing inside auto-layout inserts at the pointer slot after dimensions are committed', () => {
    const {
      editor,
      frame,
      children: [a, b, c]
    } = setup('HORIZONTAL')
    const drag = startDraw(editor, 160, 170)
    handleDrawMove(drag, 200, 195, false)
    expect(frame.childIds).toEqual([a.id, b.id, c.id])
    drag.commit()
    expect(frame.childIds).toEqual([a.id, drag.nodeId, b.id, c.id])
    expect(editor.graph.getNode(drag.nodeId)).toMatchObject({ width: 40, height: 25 })
    editor.undoAction()
    expect(frame.childIds).toEqual([a.id, b.id, c.id])
    editor.redoAction()
    expect(frame.childIds).toEqual([a.id, drag.nodeId, b.id, c.id])
    editor.dispose()
  })

  test('rotated-frame creation preserves the draft world transform through undo and redo', () => {
    const { editor, frame } = setup()
    editor.graph.updateNode(frame.id, { rotation: 30 })
    const point = Matrix.mapPoint(getWorldMatrix(frame, editor.graph), { x: 100, y: 50 })
    const drag = startDraw(editor, point.x, point.y)
    handleDrawMove(drag, point.x + 30, point.y + 20, false)
    const draft = editor.graph.getNode(drag.nodeId)
    if (!draft) throw new Error('Missing draft')
    const before = getWorldMatrix(draft, editor.graph)
    drag.commit()
    expect(draft.parentId).toBe(frame.id)
    getWorldMatrix(draft, editor.graph).forEach((value, index) =>
      expect(value).toBeCloseTo(before[index], 5)
    )
    editor.undoAction()
    editor.redoAction()
    const restored = editor.graph.getNode(drag.nodeId)
    if (!restored) throw new Error('Missing restored frame')
    getWorldMatrix(restored, editor.graph).forEach((value, index) =>
      expect(value).toBeCloseTo(before[index], 5)
    )
    editor.dispose()
  })
})
