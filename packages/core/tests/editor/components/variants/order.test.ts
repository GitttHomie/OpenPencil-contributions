import { expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'

function setup() {
  const editor = createEditor()
  const component = editor.graph.createNode('COMPONENT', editor.state.currentPageId, {
    name: 'Button',
    width: 100,
    height: 40
  })
  editor.addVariant(component.id)
  editor.addVariant(component.id)
  const set = editor.graph.getNode(component.parentId ?? '')
  if (!set) throw new Error('Missing set')
  return { editor, component, set }
}

test('reordering variants moves auto-layout children and survives undo and redo', () => {
  const { editor, set } = setup()
  try {
    const original = [...set.childIds]
    const reordered = [original[2], original[0], original[1]]
    expect(editor.reorderVariants(set.id, reordered)).toBe(true)
    const assertOrder = (ids: string[]) => {
      expect(set.childIds).toEqual(ids)
      expect(ids.map((id) => editor.graph.getNode(id)?.x)).toEqual([20, 140, 260])
      expect(editor.getDefaultVariantForComponentSet(set.id)?.id).toBe(ids[0])
    }
    assertOrder(reordered)
    editor.undo.undo()
    assertOrder(original)
    editor.undo.redo()
    assertOrder(reordered)
    expect(editor.reorderVariants(set.id, [original[0], original[0], original[1]])).toBe(false)
    expect(set.childIds).toEqual(reordered)
  } finally {
    editor.dispose()
  }
})

test('deleting a variant retains descriptor options; undo restores its original order and name', () => {
  const { editor, set } = setup()
  try {
    const original = [...set.childIds]
    const middle = editor.graph.getNode(original[1])
    if (!middle) throw new Error('Missing middle variant')
    const name = middle.name
    const definitions = structuredClone(set.componentPropertyDefinitions)
    expect(editor.removeVariant(middle.id)).toBe(true)
    expect(editor.graph.getNode(middle.id)).toBeUndefined()
    expect(set.childIds).toEqual([original[0], original[2]])
    expect(set.componentPropertyDefinitions[0].variantOptions).toEqual([
      'Default',
      'Variant 2',
      'Variant 3'
    ])
    editor.undo.undo()
    expect(set.childIds).toEqual(original)
    expect(editor.graph.getNode(middle.id)?.name).toBe(name)
    expect(set.componentPropertyDefinitions).toEqual(definitions)
    editor.undo.redo()
    expect(set.childIds).toEqual([original[0], original[2]])
    editor.removeVariant(original[2])
    expect(editor.removeVariant(original[0])).toBe(false)
  } finally {
    editor.dispose()
  }
})

test('attributes reorder independently of variant dimensions and work on standalone components', () => {
  const { editor, set } = setup()
  try {
    const textId = editor.createComponentProperty(set.id, 'Label', 'TEXT', 'Button')
    const booleanId = editor.createComponentProperty(set.id, 'Visible', 'BOOLEAN', 'true')
    const dimensionId = editor.addPropertyDefinition(set.id, 'State', 'VARIANT', 'Enabled')
    if (!textId || !booleanId || !dimensionId) throw new Error('Missing properties')
    const original = set.componentPropertyDefinitions.map((item) => item.id)
    editor.graph.updateNode(set.childIds[0], { name: 'Custom variant name' })
    const names = editor.graph.getChildren(set.id).map((node) => node.name)
    expect(editor.reorderPropertyDefinitions(set.id, [booleanId, textId])).toBe(true)
    expect(editor.graph.getChildren(set.id).map((node) => node.name)).toEqual(names)
    expect(set.componentPropertyDefinitions.map((item) => item.id)).toEqual([
      original[0],
      booleanId,
      textId,
      dimensionId
    ])
    expect(editor.reorderPropertyDefinitions(set.id, [dimensionId, original[0]])).toBe(true)
    expect(set.componentPropertyDefinitions.map((item) => item.id)).toEqual([
      dimensionId,
      booleanId,
      textId,
      original[0]
    ])
    editor.undo.undo()
    expect(editor.graph.getChildren(set.id).map((node) => node.name)).toEqual(names)
    editor.undo.undo()
    expect(set.componentPropertyDefinitions.map((item) => item.id)).toEqual(original)
    const standalone = editor.graph.createNode('COMPONENT', editor.state.currentPageId)
    const first = editor.createComponentProperty(standalone.id, 'First', 'TEXT', '')
    const second = editor.createComponentProperty(standalone.id, 'Second', 'BOOLEAN', 'true')
    if (!first || !second) throw new Error('Missing standalone properties')
    expect(editor.reorderPropertyDefinitions(standalone.id, [second, first])).toBe(true)
    expect(standalone.componentPropertyDefinitions.map((item) => item.id)).toEqual([second, first])
    editor.undo.undo()
    expect(standalone.componentPropertyDefinitions.map((item) => item.id)).toEqual([first, second])
  } finally {
    editor.dispose()
  }
})

test('removing the last variant dimension never erases component names', () => {
  const { editor, set } = setup()
  try {
    const names = editor.graph.getChildren(set.id).map((node) => node.name)
    editor.removePropertyDefinition(set.id, set.componentPropertyDefinitions[0].id)
    expect(editor.graph.getChildren(set.id).map((node) => node.name)).toEqual(names)
    editor.undo.undo()
    expect(set.componentPropertyDefinitions).toHaveLength(1)
  } finally {
    editor.dispose()
  }
})
