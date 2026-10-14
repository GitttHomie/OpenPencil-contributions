import { describe, expect, test } from 'bun:test'

import { createEditor, type Editor, type LayoutSizingConversion } from '@open-pencil/core/editor'
import { layoutSizing, type SceneNode } from '@open-pencil/scene-graph'

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

describe('Hug with independently sized contents', () => {
  for (const axis of ['width', 'height'] as const) {
    const sizingAxis = axis === 'width' ? 'HORIZONTAL' : 'VERTICAL'
    const mode = axis === 'width' ? 'VERTICAL' : 'HORIZONTAL'

    function scene(siblingChanges: Partial<SceneNode> = {}) {
      const editor = createEditor()
      const notices: LayoutSizingConversion[] = []
      editor.onEditorEvent('layout:sizing-converted', (event) => notices.push(event))
      const parent = editor.graph.createNode('FRAME', editor.state.currentPageId, {
        name: 'Button',
        width: 300,
        height: 300,
        layoutMode: mode,
        primaryAxisSizing: 'FIXED',
        counterAxisSizing: 'FIXED'
      })
      const child = editor.graph.createNode('FRAME', parent.id, {
        name: 'Label',
        layoutMode: mode,
        width: 250,
        height: 250
      })
      const sibling = editor.graph.createNode('FRAME', parent.id, {
        width: 120,
        height: 120,
        ...siblingChanges
      })
      return { editor, notices, parent, child, sibling }
    }

    test(`${axis}: Hug retains Fill, follows the independent size in both directions, and undoes`, () => {
      const { editor, parent, child, sibling, notices } = scene()
      try {
        editor.setLayoutSizing(child.id, axis, 'FILL')
        const before = snapshot(editor)
        editor.setLayoutSizing(parent.id, axis, 'HUG')
        expect(parent.counterAxisSizing).toBe('HUG')
        expect(layoutSizing(editor.graph, child, sizingAxis)).toBe('FILL')
        expect(parent[axis]).toBe(120)
        expect(child[axis]).toBe(120)
        const hugged = snapshot(editor)
        editor.undoAction()
        expect(snapshot(editor)).toEqual(before)
        editor.redoAction()
        expect(snapshot(editor)).toEqual(hugged)
        for (const size of [200, 80]) {
          editor.updateNode(sibling.id, { [axis]: size })
          expect(parent[axis]).toBe(size)
          expect(child[axis]).toBe(size)
        }
        expect(notices).toEqual([])
      } finally {
        editor.dispose()
      }
    })

    test(`${axis}: choosing Fill preserves Hug until the last independent layer is set to Fill`, () => {
      const { editor, parent, child, sibling, notices } = scene()
      try {
        editor.setLayoutSizing(parent.id, axis, 'HUG')
        editor.setLayoutSizing(child.id, axis, 'FILL')
        expect(parent.counterAxisSizing).toBe('HUG')
        expect(parent[axis]).toBe(120)
        expect(notices).toEqual([])
        const before = snapshot(editor)
        editor.setLayoutSizing(sibling.id, axis, 'FILL')
        expect(parent.counterAxisSizing).toBe('FIXED')
        expect(parent[axis]).toBe(120)
        expect(notices).toEqual([
          {
            kind: 'container',
            axis,
            containerName: 'Button',
            layerName: sibling.name
          }
        ])
        editor.undoAction()
        expect(snapshot(editor)).toEqual(before)
        editor.redoAction()
        expect(notices).toHaveLength(1)
      } finally {
        editor.dispose()
      }
    })

    for (const siblingChanges of [
      { visible: false },
      { layoutPositioning: 'ABSOLUTE' as const },
      { layoutAlignSelf: 'STRETCH' as const }
    ]) {
      test(`${axis}: ${JSON.stringify(siblingChanges)} cannot establish the Hug size`, () => {
        const { editor, parent, child, notices } = scene(siblingChanges)
        try {
          editor.setLayoutSizing(parent.id, axis, 'HUG')
          notices.length = 0
          editor.setLayoutSizing(child.id, axis, 'FILL')
          expect(parent.counterAxisSizing).toBe('FIXED')
          expect(notices).toEqual([
            {
              kind: 'container',
              axis,
              containerName: 'Button',
              layerName: 'Label'
            }
          ])
        } finally {
          editor.dispose()
        }
      })
    }

    test(`${axis}: a Hug sibling establishes its size from content`, () => {
      const { editor, parent, child, sibling, notices } = scene({
        layoutMode: mode,
        counterAxisSizing: 'HUG'
      })
      try {
        editor.graph.createNode('FRAME', sibling.id, { width: 90, height: 90 })
        editor.setLayoutSizing(child.id, axis, 'FILL')
        editor.setLayoutSizing(parent.id, axis, 'HUG')
        expect(parent.counterAxisSizing).toBe('HUG')
        expect(parent[axis]).toBe(90)
        expect(child[axis]).toBe(90)
        expect(notices).toEqual([])
      } finally {
        editor.dispose()
      }
    })

    test(`${axis}: inherited Fill does not qualify as an independent layer`, () => {
      const { editor, parent, child, notices } = scene()
      try {
        editor.graph.updateNode(parent.id, { counterAxisAlign: 'STRETCH' })
        editor.setLayoutSizing(parent.id, axis, 'HUG')
        expect(layoutSizing(editor.graph, child, sizingAxis)).toBe('FIXED')
        expect(notices).toEqual([{ kind: 'contents', axis, containerName: 'Button', count: 2 }])
      } finally {
        editor.dispose()
      }
    })

    test(`${axis}: setting both layers to Fill in one batch freezes once and undoes together`, () => {
      const { editor, parent, child, sibling, notices } = scene()
      try {
        editor.setLayoutSizing(parent.id, axis, 'HUG')
        const before = snapshot(editor)
        editor.undo.runBatch('Set selection sizing', () => {
          editor.setLayoutSizing(child.id, axis, 'FILL')
          editor.setLayoutSizing(sibling.id, axis, 'FILL')
        })
        expect(parent.counterAxisSizing).toBe('FIXED')
        expect(notices).toHaveLength(1)
        expect(layoutSizing(editor.graph, child, sizingAxis)).toBe('FILL')
        expect(layoutSizing(editor.graph, sibling, sizingAxis)).toBe('FILL')
        editor.undoAction()
        expect(snapshot(editor)).toEqual(before)
      } finally {
        editor.dispose()
      }
    })

    test(`${axis}: along the flow, Hug freezes all Fill sizes together and reports once`, () => {
      const { editor, parent, child, sibling, notices } = scene({
        layoutGrow: 1
      })
      try {
        editor.graph.updateNode(parent.id, {
          layoutMode: sizingAxis,
          primaryAxisSizing: 'FIXED'
        })
        editor.setLayoutSizing(child.id, axis, 'FILL')
        editor.graph.createNode('FRAME', parent.id, { width: 40, height: 40 })
        editor.updateNode(parent.id, { [axis]: 400 })
        const sizes = [child[axis], sibling[axis]]
        const before = snapshot(editor)
        editor.setLayoutSizing(parent.id, axis, 'HUG')
        expect(layoutSizing(editor.graph, child, sizingAxis)).toBe('FIXED')
        expect(layoutSizing(editor.graph, sibling, sizingAxis)).toBe('FIXED')
        expect([child[axis], sibling[axis]]).toEqual(sizes)
        expect(notices).toEqual([
          {
            kind: 'contents',
            axis,
            containerName: 'Button',
            count: 2
          }
        ])
        const after = snapshot(editor)
        editor.setLayoutSizing(parent.id, axis, 'HUG')
        expect(notices).toHaveLength(1)
        editor.undoAction()
        expect(snapshot(editor)).toEqual(before)
        editor.redoAction()
        expect(snapshot(editor)).toEqual(after)
      } finally {
        editor.dispose()
      }
    })
  }
})
