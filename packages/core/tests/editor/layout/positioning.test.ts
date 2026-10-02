import { describe, expect, test } from 'bun:test'

import { createEditor, type Editor } from '@open-pencil/core/editor'
import type { LayoutMode, Rect } from '@open-pencil/scene-graph'

function scene(mode: LayoutMode = 'HORIZONTAL') {
  const editor = createEditor()
  const parent = editor.graph.createNode('FRAME', editor.state.currentPageId, {
    x: 100,
    y: 100,
    width: 300,
    height: 200,
    layoutMode: mode,
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'HUG',
    itemSpacing: 12,
    paddingLeft: 10,
    paddingRight: 10,
    paddingTop: 10,
    paddingBottom: 10,
    gridTemplateColumns: [
      { sizing: 'FIXED', value: 100 },
      { sizing: 'FIXED', value: 100 }
    ],
    gridTemplateRows: [
      { sizing: 'FIXED', value: 80 },
      { sizing: 'FIXED', value: 80 }
    ]
  })
  const children = [0, 1, 2].map(() =>
    editor.graph.createNode('RECTANGLE', parent.id, {
      width: 60,
      height: 40
    })
  )
  editor.runLayoutForNode(parent.id)
  return { editor, parent, children }
}

function geometry(editor: Editor) {
  return [...editor.graph.nodes.values()].map((n) => ({
    id: n.id,
    parentId: n.parentId,
    childIds: [...n.childIds],
    x: n.x,
    y: n.y,
    width: n.width,
    height: n.height,
    layoutPositioning: n.layoutPositioning,
    primaryAxisSizing: n.primaryAxisSizing,
    counterAxisSizing: n.counterAxisSizing,
    layoutGrow: n.layoutGrow,
    layoutAlignSelf: n.layoutAlignSelf
  }))
}

function rect(n: Rect) {
  return { x: n.x, y: n.y, width: n.width, height: n.height }
}

describe('exclude from auto layout', () => {
  for (const mode of ['HORIZONTAL', 'VERTICAL', 'GRID'] as const) {
    test(`${mode}: preserves the excluded child's rectangle and layer order, restores exact history`, () => {
      const {
        editor,
        parent,
        children: [first, middle, last]
      } = scene(mode)
      try {
        const before = geometry(editor)
        const originalRect = rect(middle)
        const parentSize = rect(parent)
        editor.setLayoutPositioning([middle.id], 'ABSOLUTE')
        expect(rect(middle)).toEqual(originalRect)
        expect(parent.childIds).toEqual([first.id, middle.id, last.id])
        if (mode === 'HORIZONTAL') expect(parent.width).toBeLessThan(parentSize.width)
        if (mode === 'VERTICAL') expect(parent.height).toBeLessThan(parentSize.height)
        const excluded = geometry(editor)
        editor.undoAction()
        expect(geometry(editor)).toEqual(before)
        expect(editor.undo.canUndo).toBe(false)
        editor.redoAction()
        expect(geometry(editor)).toEqual(excluded)
        editor.setLayoutPositioning([middle.id], 'AUTO')
        expect(geometry(editor)).toEqual(before)
        editor.undoAction()
        expect(geometry(editor)).toEqual(excluded)
      } finally {
        editor.dispose()
      }
    })
  }

  test('multi-selection freezes original Fill dimensions before any sibling reflows', () => {
    const {
      editor,
      parent,
      children: [first, middle, last]
    } = scene()
    try {
      editor.graph.updateNode(parent.id, { primaryAxisSizing: 'FIXED', width: 500 })
      for (const child of [middle, last])
        editor.graph.updateNode(child.id, {
          layoutGrow: 1,
          layoutAlignSelf: 'STRETCH',
          primaryAxisSizing: 'FILL'
        })
      editor.runLayoutForNode(parent.id)
      const before = geometry(editor)
      const rects = [rect(middle), rect(last)]
      editor.setLayoutPositioning([middle.id, last.id], 'ABSOLUTE')
      expect([rect(middle), rect(last)]).toEqual(rects)
      for (const child of [middle, last]) {
        expect(child.primaryAxisSizing).toBe('FIXED')
        expect(child.layoutGrow).toBe(0)
        expect(child.layoutAlignSelf).toBe('AUTO')
      }
      expect(first.layoutPositioning).toBe('AUTO')
      editor.undoAction()
      expect(geometry(editor)).toEqual(before)
      expect(editor.undo.canUndo).toBe(false)
    } finally {
      editor.dispose()
    }
  })

  test('exclusion preserves the original position before right and bottom constraints take effect', () => {
    const {
      editor,
      children: [, middle]
    } = scene()
    try {
      editor.graph.updateNode(middle.id, {
        horizontalConstraint: 'MAX',
        verticalConstraint: 'MAX'
      })
      const before = geometry(editor)
      const original = rect(middle)
      editor.setLayoutPositioning([middle.id], 'ABSOLUTE')
      expect(rect(middle)).toEqual(original)
      const excluded = geometry(editor)
      editor.undoAction()
      expect(geometry(editor)).toEqual(before)
      editor.redoAction()
      expect(geometry(editor)).toEqual(excluded)
    } finally {
      editor.dispose()
    }
  })

  test('exclusion preserves a nested frame’s own Hug layout', () => {
    const { editor, parent } = scene()
    try {
      const frame = editor.graph.createNode('FRAME', parent.id, {
        layoutMode: 'HORIZONTAL',
        primaryAxisSizing: 'HUG',
        counterAxisSizing: 'HUG'
      })
      const child = editor.graph.createNode('RECTANGLE', frame.id, { width: 30, height: 20 })
      editor.runLayoutForNode(parent.id)
      editor.setLayoutPositioning([frame.id], 'ABSOLUTE')
      expect(frame.primaryAxisSizing).toBe('HUG')
      editor.updateNode(child.id, { width: 80 })
      expect(frame.width).toBe(80)
    } finally {
      editor.dispose()
    }
  })

  test('invalid mixed parents and no-op toggles do not create history', () => {
    const {
      editor,
      parent,
      children: [first]
    } = scene()
    try {
      const before = geometry(editor)
      editor.setLayoutPositioning([first.id, parent.id], 'ABSOLUTE')
      editor.setLayoutPositioning([first.id], 'AUTO')
      expect(geometry(editor)).toEqual(before)
      expect(editor.undo.canUndo).toBe(false)
    } finally {
      editor.dispose()
    }
  })

  test('manual alignment cannot move a flow child, but works after exclusion', () => {
    const {
      editor,
      children: [first, middle]
    } = scene()
    try {
      const before = geometry(editor)
      editor.alignNodes([first.id, middle.id], 'horizontal', 'center')
      expect(geometry(editor)).toEqual(before)
      expect(editor.undo.canUndo).toBe(false)
      editor.setLayoutPositioning([middle.id], 'ABSOLUTE')
      const x = middle.x
      editor.alignNodes([middle.id], 'horizontal', 'min')
      expect(middle.x).not.toBe(x)
    } finally {
      editor.dispose()
    }
  })
})
