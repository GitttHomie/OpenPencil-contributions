import { describe, expect, test } from 'bun:test'

import { createEditor, type Editor } from '@open-pencil/core/editor'

function restoredScene(derived: boolean) {
  const editor = createEditor()
  const parent = editor.graph.createNode('FRAME', editor.state.currentPageId, {
    x: 100,
    y: 100,
    width: 480,
    height: 360
  })
  const child = editor.graph.createNode('FRAME', parent.id, {
    x: 220,
    y: 150,
    width: 140,
    height: 90,
    horizontalConstraint: 'STRETCH',
    verticalConstraint: 'STRETCH'
  })
  for (const node of [parent, child]) {
    editor.graph.applyImportedStateDuring(() =>
      editor.graph.updateNode(node.id, {
        source: { ...node.source, format: 'fig', id: node.id },
        derivedLayout: derived
          ? { x: node.x, y: node.y, width: node.width, height: node.height }
          : null
      })
    )
  }
  return { editor, parent, child }
}

function snapshot(editor: Editor) {
  return [...editor.graph.nodes.values()].map((n) => ({
    id: n.id,
    x: n.x,
    y: n.y,
    width: n.width,
    height: n.height,
    parentId: n.parentId,
    childIds: [...n.childIds],
    layoutMode: n.layoutMode,
    primaryAxisSizing: n.primaryAxisSizing,
    counterAxisSizing: n.counterAxisSizing,
    layoutGrow: n.layoutGrow,
    layoutAlignSelf: n.layoutAlignSelf,
    horizontalConstraint: n.horizontalConstraint,
    verticalConstraint: n.verticalConstraint,
    derivedLayout: structuredClone(n.derivedLayout),
    source: structuredClone(n.source)
  }))
}

describe('restored frame layout and sizing edits', () => {
  for (const derived of [false, true]) {
    for (const mode of ['HORIZONTAL', 'VERTICAL'] as const) {
      test(`${mode}, derived=${derived}: constraints yield to flow, Fill freezes Hug axes, and undo restores every step`, () => {
        const { editor, parent, child } = restoredScene(derived)
        try {
          const original = snapshot(editor)
          editor.setLayoutMode(parent.id, mode)
          expect(parent).toMatchObject({ x: 100, y: 100, width: 140, height: 90 })
          expect(child).toMatchObject({
            x: 0,
            y: 0,
            width: 140,
            height: 90,
            horizontalConstraint: 'STRETCH',
            verticalConstraint: 'STRETCH'
          })
          const flow = snapshot(editor)
          editor.setLayoutSizing(child.id, 'width', 'FILL')
          expect(parent).toMatchObject({ width: 140, height: 90 })
          expect(parent[mode === 'HORIZONTAL' ? 'primaryAxisSizing' : 'counterAxisSizing']).toBe(
            'FIXED'
          )
          expect(parent[mode === 'HORIZONTAL' ? 'counterAxisSizing' : 'primaryAxisSizing']).toBe(
            'HUG'
          )
          const fillWidth = snapshot(editor)
          editor.setLayoutSizing(child.id, 'height', 'FILL')
          expect(parent).toMatchObject({
            width: 140,
            height: 90,
            primaryAxisSizing: 'FIXED',
            counterAxisSizing: 'FIXED'
          })
          expect(child).toMatchObject({ x: 0, y: 0, width: 140, height: 90 })
          const fillBoth = snapshot(editor)
          editor.undoAction()
          expect(snapshot(editor)).toEqual(fillWidth)
          editor.undoAction()
          expect(snapshot(editor)).toEqual(flow)
          editor.undoAction()
          expect(snapshot(editor)).toEqual(original)
          expect(editor.undo.canUndo).toBe(false)
          editor.redoAction()
          editor.redoAction()
          editor.redoAction()
          expect(snapshot(editor)).toEqual(fillBoth)
          editor.updateNode(parent.id, { width: 320, height: 240 })
          expect(child).toMatchObject({ x: 0, y: 0, width: 320, height: 240 })
          const resized = snapshot(editor)
          editor.setLayoutSizing(parent.id, 'width', 'HUG')
          expect(parent.width).toBe(320)
          expect(child.width).toBe(320)
          editor.undoAction()
          expect(snapshot(editor)).toEqual(resized)
        } finally {
          editor.dispose()
        }
      })
    }
  }

  test('fresh frames also avoid circular Fill and Hug sizing', () => {
    const editor = createEditor()
    try {
      const parent = editor.graph.createNode('FRAME', editor.state.currentPageId, {
        width: 140,
        height: 90,
        layoutMode: 'VERTICAL',
        primaryAxisSizing: 'HUG',
        counterAxisSizing: 'HUG'
      })
      const child = editor.graph.createNode('FRAME', parent.id, { width: 140, height: 90 })
      editor.setLayoutSizing(child.id, 'width', 'FILL')
      editor.setLayoutSizing(child.id, 'height', 'FILL')
      expect(parent).toMatchObject({ width: 140, height: 90 })
      expect(child).toMatchObject({ width: 140, height: 90 })
    } finally {
      editor.dispose()
    }
  })
})
