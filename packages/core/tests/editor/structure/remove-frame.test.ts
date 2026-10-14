import { expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'

test('removing a rotated frame preserves component children, stacking and world transforms through undo', () => {
  const editor = createEditor()
  const graph = editor.graph
  const page = editor.state.currentPageId
  const before = graph.createNode('RECTANGLE', page)
  const frame = graph.createNode('FRAME', page, {
    x: 100,
    y: 200,
    width: 300,
    height: 200,
    rotation: 30
  })
  const component = graph.createNode('COMPONENT', frame.id, { x: 25, y: 40, width: 80, height: 40 })
  const label = graph.createNode('TEXT', component.id, { text: 'Button' })
  const after = graph.createNode('RECTANGLE', page)
  const world = getWorldMatrix(component, graph)
  editor.select([frame.id])
  editor.ungroupSelected()
  expect(graph.getNode(frame.id)).toBeUndefined()
  expect(graph.getNode(component.id)?.type).toBe('COMPONENT')
  expect(graph.getNode(label.id)?.parentId).toBe(component.id)
  expect(graph.getChildren(page).map((node) => node.id)).toEqual([
    before.id,
    component.id,
    after.id
  ])
  const moved = getWorldMatrix(component, graph)
  moved.forEach((value, index) => expect(value).toBeCloseTo(world[index], 6))
  editor.undoAction()
  expect(graph.getNode(frame.id)?.type).toBe('FRAME')
  expect(graph.getNode(component.id)).toMatchObject({
    parentId: frame.id,
    x: 25,
    y: 40,
    rotation: 0
  })
  expect([...editor.state.selectedIds]).toEqual([frame.id])
  editor.redoAction()
  expect(graph.getNode(component.id)?.parentId).toBe(page)
})

test('removing an auto-layout frame preserves its laid-out children and restores the layout on undo', () => {
  const editor = createEditor()
  const frame = editor.graph.createNode('FRAME', editor.state.currentPageId, {
    x: 300,
    y: 200,
    layoutMode: 'HORIZONTAL',
    width: 200,
    height: 80,
    paddingLeft: 12,
    itemSpacing: 8
  })
  const a = editor.graph.createNode('RECTANGLE', frame.id, { width: 40, height: 30 })
  const b = editor.graph.createNode('FRAME', frame.id, { width: 60, height: 30 })
  editor.runLayoutForNode(frame.id)
  const worlds = [a, b].map((node) => getWorldMatrix(node, editor.graph))
  editor.select([frame.id])
  editor.ungroupSelected()
  for (const [index, node] of [a, b].entries()) {
    getWorldMatrix(node, editor.graph).forEach((value, i) =>
      expect(value).toBeCloseTo(worlds[index][i], 6)
    )
  }
  editor.undoAction()
  expect(editor.graph.getNode(frame.id)?.layoutMode).toBe('HORIZONTAL')
  expect(editor.graph.getChildren(frame.id).map((node) => node.id)).toEqual([a.id, b.id])
})

test('cannot remove containers inside an instance or detach a whole instance by ungrouping', () => {
  const editor = createEditor()
  const instance = editor.graph.createNode('INSTANCE', editor.state.currentPageId)
  const frame = editor.graph.createNode('FRAME', instance.id)
  editor.graph.createNode('TEXT', frame.id)
  editor.select([frame.id])
  editor.ungroupSelected()
  expect(editor.graph.getNode(frame.id)?.parentId).toBe(instance.id)
  editor.select([instance.id])
  editor.ungroupSelected()
  expect(editor.graph.getNode(instance.id)).toBeDefined()
})
