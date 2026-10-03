import { expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { hasInstanceOverride } from '@open-pencil/scene-graph'

import { createEditor } from '#core/editor'

function fixture() {
  const editor = createEditor()
  const component = editor.graph.createNode('COMPONENT', editor.state.currentPageId, {
    width: 120,
    height: 40
  })
  const badge = editor.graph.createNode('FRAME', component.id, {
    name: 'Badge',
    x: 100,
    y: -8,
    width: 24,
    height: 24
  })
  editor.graph.createNode('TEXT', badge.id, { text: '1' })
  const instance = expectDefined(
    editor.graph.createInstance(component.id, editor.state.currentPageId)
  )
  const copy = expectDefined(editor.graph.getChildren(instance.id)[0])
  return { editor, component, badge, instance, copy }
}

test('Delete hides an instance child, preserves its subtree and override, and supports undo/redo', async () => {
  const { editor, badge, copy, instance } = fixture()
  try {
    await Promise.resolve()
    const childIds = [...copy.childIds]
    editor.select([copy.id])
    editor.deleteSelected()
    expect(editor.graph.getNode(copy.id)).toBe(copy)
    expect(copy.visible).toBe(false)
    expect(copy.childIds).toEqual(childIds)
    expect(instance.childIds).toContain(copy.id)
    expect(hasInstanceOverride(editor.graph, copy.id, 'visible')).toBe(true)
    expect(editor.state.selectedIds.size).toBe(0)
    editor.undoAction()
    expect(copy.visible).toBe(true)
    expect(hasInstanceOverride(editor.graph, copy.id, 'visible')).toBe(false)
    expect([...editor.state.selectedIds]).toEqual([copy.id])
    editor.redoAction()
    editor.updateNodeWithUndo(badge.id, { name: 'Updated badge', x: 104 })
    await Promise.resolve()
    expect(copy).toMatchObject({ visible: false, name: 'Updated badge', x: 104 })
    expect(badge.visible).toBe(true)
  } finally {
    editor.dispose()
  }
})

test('deleting the main component badge removes it from instances immediately and undo restores it', async () => {
  const { editor, badge, instance } = fixture()
  try {
    await Promise.resolve()
    editor.select([badge.id])
    editor.deleteSelected()
    await Promise.resolve()
    expect(editor.graph.getChildren(instance.id)).toHaveLength(0)
    editor.undoAction()
    await Promise.resolve()
    const restored = editor.graph.getChildren(instance.id)[0]
    expect(restored).toMatchObject({ componentId: badge.id, visible: true })
    expect(editor.graph.getChildren(expectDefined(restored).id)).toHaveLength(1)
  } finally {
    editor.dispose()
  }
})

test('mixed selections hide instance children and delete ordinary nodes in a single undo', async () => {
  const { editor, copy } = fixture()
  try {
    await Promise.resolve()
    const frame = editor.graph.createNode('FRAME', editor.state.currentPageId)
    editor.select([copy.id, ...copy.childIds, frame.id])
    editor.deleteSelected()
    expect(copy.visible).toBe(false)
    expect(editor.graph.getChildren(copy.id)[0].visible).toBe(true)
    expect(editor.graph.getNode(frame.id)).toBeUndefined()
    editor.undoAction()
    expect(copy.visible).toBe(true)
    expect(editor.graph.getNode(frame.id)).toBeDefined()
  } finally {
    editor.dispose()
  }
})

test('an entire instance can be deleted even when one of its descendants is selected too', async () => {
  const { editor, instance, copy, component } = fixture()
  try {
    await Promise.resolve()
    editor.select([instance.id, ...copy.childIds])
    editor.deleteSelected()
    expect(editor.graph.getNode(instance.id)).toBeUndefined()
    expect(editor.graph.getNode(component.id)).toBeDefined()
    editor.undoAction()
    expect(editor.graph.getNode(instance.id)).toBeDefined()
    expect(editor.graph.getNode(copy.id)?.visible).toBe(true)
  } finally {
    editor.dispose()
  }
})

test('Delete hides a nested instance and an outer component edit keeps it hidden', async () => {
  const { editor, component } = fixture()
  try {
    const outer = editor.graph.createNode('COMPONENT', editor.state.currentPageId)
    const nested = expectDefined(editor.graph.createInstance(component.id, outer.id))
    const outerInstance = expectDefined(
      editor.graph.createInstance(outer.id, editor.state.currentPageId)
    )
    await Promise.resolve()
    const copy = expectDefined(editor.graph.getChildren(outerInstance.id)[0])
    editor.select([copy.id])
    editor.deleteSelected()
    editor.updateNodeWithUndo(nested.id, { opacity: 0.5 })
    await Promise.resolve()
    expect(editor.graph.getNode(copy.id)).toBe(copy)
    expect(copy).toMatchObject({ visible: false, opacity: 0.5 })
    expect(nested.visible).toBe(true)
  } finally {
    editor.dispose()
  }
})
