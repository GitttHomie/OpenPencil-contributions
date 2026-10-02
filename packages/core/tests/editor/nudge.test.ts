import { describe, test, expect } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'

import { getNodeOrThrow } from '../helpers/assert'

describe('nudgeSelected', () => {
  function setup() {
    const editor = createEditor()
    const pageId = editor.graph.getPages()[0].id
    const rect = editor.graph.createNode('RECTANGLE', pageId, {
      name: 'Rect',
      x: 100,
      y: 200,
      width: 50,
      height: 50
    })
    editor.select([rect.id])
    return { editor, rect }
  }

  test('nudge moves selected node by 1px', () => {
    const { editor, rect } = setup()

    editor.nudgeSelected(1, 0)
    expect(getNodeOrThrow(editor.graph, rect.id).x).toBe(101)
    expect(getNodeOrThrow(editor.graph, rect.id).y).toBe(200)

    editor.nudgeSelected(0, -1)
    expect(getNodeOrThrow(editor.graph, rect.id).x).toBe(101)
    expect(getNodeOrThrow(editor.graph, rect.id).y).toBe(199)
  })

  test('shift nudge moves by 10px', () => {
    const { editor, rect } = setup()

    editor.nudgeSelected(10, 0)
    expect(getNodeOrThrow(editor.graph, rect.id).x).toBe(110)

    editor.nudgeSelected(0, 10)
    expect(getNodeOrThrow(editor.graph, rect.id).y).toBe(210)
  })

  test('nudge is undoable as a single entry', () => {
    const { editor, rect } = setup()

    editor.nudgeSelected(1, 0)
    editor.nudgeSelected(1, 0)
    editor.nudgeSelected(1, 0)
    editor.flushNudge()

    expect(getNodeOrThrow(editor.graph, rect.id).x).toBe(103)
    expect(editor.undo.canUndo).toBe(true)

    editor.undo.undo()
    expect(getNodeOrThrow(editor.graph, rect.id).x).toBe(100)
    expect(getNodeOrThrow(editor.graph, rect.id).y).toBe(200)

    editor.undo.redo()
    expect(getNodeOrThrow(editor.graph, rect.id).x).toBe(103)
  })

  test('nudge skips locked nodes', () => {
    const { editor, rect } = setup()

    editor.graph.updateNode(rect.id, { locked: true })
    editor.nudgeSelected(10, 10)
    editor.flushNudge()
    expect(getNodeOrThrow(editor.graph, rect.id).x).toBe(100)
    expect(getNodeOrThrow(editor.graph, rect.id).y).toBe(200)
    expect(editor.undo.canUndo).toBe(false)
  })

  test('nudge does nothing with no selection', () => {
    const { editor } = setup()

    editor.clearSelection()
    editor.nudgeSelected(10, 10)
    editor.flushNudge()
    expect(editor.undo.canUndo).toBe(false)
  })

  test('nudge moves multiple selected nodes', () => {
    const { editor, rect } = setup()
    const pageId = editor.graph.getPages()[0].id
    const rect2 = editor.graph.createNode('RECTANGLE', pageId, {
      name: 'Rect2',
      x: 300,
      y: 400,
      width: 50,
      height: 50
    })
    editor.select([rect.id, rect2.id])

    editor.nudgeSelected(-5, 3)
    editor.flushNudge()

    expect(getNodeOrThrow(editor.graph, rect.id).x).toBe(95)
    expect(getNodeOrThrow(editor.graph, rect.id).y).toBe(203)
    expect(getNodeOrThrow(editor.graph, rect2.id).x).toBe(295)
    expect(getNodeOrThrow(editor.graph, rect2.id).y).toBe(403)
  })

  test('separate nudge sequences create separate undo entries', () => {
    const { editor, rect } = setup()

    editor.nudgeSelected(5, 0)
    editor.flushNudge()

    editor.nudgeSelected(0, 5)
    editor.flushNudge()

    expect(getNodeOrThrow(editor.graph, rect.id).x).toBe(105)
    expect(getNodeOrThrow(editor.graph, rect.id).y).toBe(205)

    editor.undo.undo()
    expect(getNodeOrThrow(editor.graph, rect.id).x).toBe(105)
    expect(getNodeOrThrow(editor.graph, rect.id).y).toBe(200)

    editor.undo.undo()
    expect(getNodeOrThrow(editor.graph, rect.id).x).toBe(100)
    expect(getNodeOrThrow(editor.graph, rect.id).y).toBe(200)
  })
})

describe('auto-layout keyboard reordering', () => {
  function row(direction: 'LTR' | 'RTL' = 'LTR') {
    const editor = createEditor()
    const parent = editor.graph.createNode('FRAME', editor.state.currentPageId, {
      width: 400,
      height: 100,
      layoutMode: 'HORIZONTAL',
      layoutDirection: direction,
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED',
      itemSpacing: 10
    })
    const children = ['A', 'B', 'C', 'D'].map((name) =>
      editor.graph.createNode('RECTANGLE', parent.id, {
        name,
        width: 50,
        height: 40
      })
    )
    editor.runLayoutForNode(parent.id)
    return { editor, parent, children }
  }

  test('arrows reorder immediately and undo restores order, including rapid key repeats', () => {
    const {
      editor,
      parent,
      children: [a, b, c, d]
    } = row()
    editor.select([b.id])
    editor.nudgeSelected(1, 0)
    expect(parent.childIds).toEqual([a.id, c.id, b.id, d.id])
    editor.nudgeSelected(1, 0)
    expect(parent.childIds).toEqual([a.id, c.id, d.id, b.id])
    editor.undoAction()
    expect(parent.childIds).toEqual([a.id, b.id, c.id, d.id])
    expect(editor.undo.canUndo).toBe(false)
    editor.redoAction()
    expect(parent.childIds).toEqual([a.id, c.id, d.id, b.id])
    editor.dispose()
  })

  test('Shift moves one slot and perpendicular arrows leave row order unchanged', () => {
    const {
      editor,
      parent,
      children: [a, b, c, d]
    } = row()
    editor.select([b.id])
    editor.nudgeSelected(0, 10)
    expect(editor.undo.canUndo).toBe(false)
    editor.nudgeSelected(10, 0)
    expect(parent.childIds).toEqual([a.id, c.id, b.id, d.id])
    editor.dispose()
  })

  test('multi-selection moves together and ignores absolute children', () => {
    const {
      editor,
      parent,
      children: [a, b, c, d]
    } = row()
    editor.graph.updateNode(c.id, { layoutPositioning: 'ABSOLUTE' })
    editor.select([b.id, a.id])
    editor.nudgeSelected(1, 0)
    expect(parent.childIds).toEqual([d.id, a.id, c.id, b.id])
    editor.undoAction()
    expect(parent.childIds).toEqual([a.id, b.id, c.id, d.id])
    editor.select([c.id])
    const x = c.x
    editor.nudgeSelected(1, 0)
    expect(c.x).toBe(x + 1)
    editor.dispose()
  })

  test('RTL rows use visual direction and vertical lists use up/down', () => {
    const {
      editor,
      parent,
      children: [a, b, c, d]
    } = row('RTL')
    editor.select([b.id])
    editor.nudgeSelected(1, 0)
    expect(parent.childIds).toEqual([b.id, a.id, c.id, d.id])
    editor.graph.updateNode(parent.id, { layoutMode: 'VERTICAL' })
    editor.nudgeSelected(0, 1)
    expect(parent.childIds).toEqual([a.id, b.id, c.id, d.id])
    editor.dispose()
  })

  test('locked ancestry and selected descendants do not move independently', () => {
    const {
      editor,
      parent,
      children: [a]
    } = row()
    editor.select([parent.id, a.id])
    const childX = a.x
    editor.nudgeSelected(10, 0)
    expect(parent.x).toBe(10)
    expect(a.x).toBe(childX)
    editor.graph.updateNode(parent.id, { locked: true })
    editor.select([a.id])
    editor.nudgeSelected(1, 0)
    expect(a.x).toBe(childX)
    editor.dispose()
  })
})
