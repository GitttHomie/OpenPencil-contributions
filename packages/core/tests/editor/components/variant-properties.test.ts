import { expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'

function setup() {
  const editor = createEditor()
  const page = editor.state.currentPageId
  const component = editor.graph.createNode('COMPONENT', page, {
    name: 'Button',
    x: 100,
    y: 100,
    width: 100,
    height: 40
  })
  const label = editor.graph.createNode('TEXT', component.id, { name: 'Label', text: 'Button' })
  const propertyId = editor.exposeComponentProperty(label.id, 'TEXT', 'Label')
  const instance = editor.graph.createInstance(component.id, page)
  if (!propertyId || !instance) throw new Error('Missing fixture')
  return { editor, page, component, label, propertyId, instance }
}

test('duplicating an existing variant shares local definitions without duplicating property identities', () => {
  const { editor, component, propertyId } = setup()
  try {
    const set = editor.graph.createNode('COMPONENT_SET', editor.state.currentPageId, {
      name: 'Button set'
    })
    editor.graph.reparentNode(component.id, set.id)
    const duplicate = editor.duplicateVariant(component.id)
    expect(duplicate).toBeString()
    expect(set.componentPropertyDefinitions.filter((item) => item.id === propertyId)).toHaveLength(
      1
    )
    expect(component.componentPropertyDefinitions).toHaveLength(0)
    expect(editor.graph.getNode(duplicate ?? '')?.componentPropertyDefinitions).toHaveLength(0)
    editor.undo.undo()
    expect(component.componentPropertyDefinitions[0].id).toBe(propertyId)
    expect(set.componentPropertyDefinitions).toHaveLength(0)
  } finally {
    editor.dispose()
  }
})

test('Add variant wraps a standalone definition atomically and preserves existing instance values', () => {
  const { editor, component, propertyId, instance } = setup()
  try {
    editor.setInstanceComponentProperty(instance.id, propertyId, 'Existing override')
    const secondId = editor.addVariant(component.id)
    const set = editor.graph.getNode(component.parentId ?? '')
    expect(set).toMatchObject({ type: 'COMPONENT_SET', name: 'Button', layoutMode: 'HORIZONTAL' })
    expect(set?.componentPropertyDefinitions.some((item) => item.id === propertyId)).toBe(true)
    expect(instance.componentId).toBe(component.id)
    expect(editor.graph.getChildren(instance.id)[0].text).toBe('Existing override')
    expect(secondId ? editor.graph.getNode(secondId)?.parentId : null).toBe(set?.id)
    expect(editor.getComponentSetVariantConflicts(set?.id ?? '')).toEqual([])
    editor.undo.undo()
    expect(editor.graph.getNode(set?.id ?? '')).toBeUndefined()
    expect(editor.graph.getNode(component.id)).toMatchObject({ name: 'Button', x: 100, y: 100 })
    expect(editor.graph.getNode(component.id)?.componentPropertyDefinitions[0].id).toBe(propertyId)
    editor.undo.redo()
    expect(editor.graph.getNode(set?.id ?? '')?.childIds).toHaveLength(2)
    expect(editor.graph.getChildren(instance.id)[0].text).toBe('Existing override')
  } finally {
    editor.dispose()
  }
})

test('variant-specific bindings hide unused controls and restore overrides when switching back', () => {
  const { editor, component, label, propertyId, instance } = setup()
  try {
    const secondId = editor.addVariant(component.id)
    if (!secondId) throw new Error('No variant')
    const setId = component.parentId ?? ''
    const secondText = editor.graph.getChildren(secondId)[0]
    editor.bindComponentProperty(secondText.id, 'TEXT', null)
    editor.setInstanceComponentProperty(instance.id, propertyId, 'Custom')
    const second = editor.graph.getNode(secondId)
    const secondValue = second?.componentPropertyValues.Variant ?? ''
    editor.switchInstanceVariant(instance.id, 'Variant', secondValue)
    expect(
      editor
        .getInstanceComponentPropertyDefinitions(instance.id)
        .some((def) => def.id === propertyId)
    ).toBe(false)
    editor.switchInstanceVariant(instance.id, 'Variant', 'Default')
    expect(
      editor
        .getInstanceComponentPropertyDefinitions(instance.id)
        .some((def) => def.id === propertyId)
    ).toBe(true)
    expect(editor.graph.getChildren(instance.id)[0].text).toBe('Custom')
    expect(label.text).toBe('Button')
    expect(editor.graph.getNode(setId)?.childIds).toHaveLength(2)
  } finally {
    editor.dispose()
  }
})

test('variant defaults override the shared default, preserve assignments, reset and undo', async () => {
  const { editor, page, component, propertyId, instance } = setup()
  try {
    const secondId = editor.addVariant(component.id)
    if (!secondId) throw new Error('No variant')
    const setId = component.parentId ?? ''
    const secondInstance = editor.graph.createInstance(secondId, page)
    if (!secondInstance) throw new Error('No instance')
    editor.setInstanceComponentProperty(instance.id, propertyId, 'Custom')
    expect(editor.setComponentPropertyVariantDefault(secondId, propertyId, 'Alternative')).toBe(
      true
    )
    await Promise.resolve()
    editor.setComponentPropertyDefault(setId, propertyId, 'Shared')
    await Promise.resolve()
    expect(editor.graph.getChildren(component.id)[0].text).toBe('Shared')
    expect(editor.graph.getChildren(secondId)[0].text).toBe('Alternative')
    expect(editor.graph.getChildren(secondInstance.id)[0].text).toBe('Alternative')
    expect(editor.graph.getChildren(instance.id)[0].text).toBe('Custom')
    expect(
      editor
        .getInstanceComponentPropertyDefinitions(secondInstance.id)
        .find((def) => def.id === propertyId)?.defaultValue
    ).toBe('Alternative')
    editor.setComponentPropertyVariantDefault(secondId, propertyId, null)
    expect(editor.graph.getChildren(secondId)[0].text).toBe('Shared')
    editor.undo.undo()
    expect(editor.graph.getChildren(secondId)[0].text).toBe('Alternative')
    editor.deleteComponentProperty(setId, propertyId)
    editor.undo.undo()
    expect(
      editor
        .getInstanceComponentPropertyDefinitions(secondInstance.id)
        .find((def) => def.id === propertyId)?.defaultValue
    ).toBe('Alternative')
  } finally {
    editor.dispose()
  }
})
