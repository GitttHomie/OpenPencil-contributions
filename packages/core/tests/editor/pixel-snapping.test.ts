import { expect, test } from 'bun:test'

import { createEditor } from '#core/editor'

test('typed geometry keeps decimals; nudging snaps position and undo restores the typed values', () => {
  const editor = createEditor()
  try {
    const id = editor.createShape('FRAME', 10.3, 20.8, 100.3, 80.8)
    const node = editor.graph.getNode(id)
    expect(node).toMatchObject({ x: 10, y: 21, width: 100, height: 81 })
    const preview = editor.beginNodePreview('Type geometry')
    preview.update(id, { x: 10.3, y: 20.8, width: 100.3, height: 80.8 })
    preview.commit()
    expect(node).toMatchObject({ x: 10.3, y: 20.8, width: 100.3, height: 80.8 })
    editor.select([id])
    editor.nudgeSelected(1, 0)
    expect(node).toMatchObject({ x: 11, y: 21, width: 100.3, height: 80.8 })
    editor.undoAction()
    expect(node).toMatchObject({ x: 10.3, y: 20.8 })
    editor.redoAction()
    expect(node).toMatchObject({ x: 11, y: 21 })
    editor.state.snappingPreferences.pixelGrid = false
    editor.updateNodeWithUndo(id, { x: 10.3, y: 20.8 })
    editor.nudgeSelected(1, 0)
    expect(node).toMatchObject({ x: 11.3, y: 20.8 })
  } finally {
    editor.dispose()
  }
})

test('manual alignment rounds half pixels while auto-layout retains fractional placement', () => {
  const editor = createEditor()
  try {
    const parent = editor.graph.createNode('FRAME', editor.state.currentPageId, {
      width: 101,
      height: 101
    })
    const child = editor.graph.createNode('FRAME', parent.id, { width: 20, height: 20 })
    editor.alignNodes([child.id], 'horizontal', 'center')
    expect(child.x).toBe(41)
    editor.undoAction()
    expect(child.x).toBe(0)
    editor.graph.updateNode(parent.id, {
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED',
      primaryAxisAlign: 'CENTER',
      counterAxisAlign: 'CENTER'
    })
    editor.runLayoutForNode(parent.id)
    expect(child.x).toBe(40.5)
    expect(child.y).toBe(40.5)
    editor.select([parent.id])
    editor.nudgeSelected(1, 0)
    expect(child.x).toBe(40.5)
    expect(child.y).toBe(40.5)
  } finally {
    editor.dispose()
  }
})
