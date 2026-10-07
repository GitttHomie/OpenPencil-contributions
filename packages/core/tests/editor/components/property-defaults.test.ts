import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'

function setup() {
  const editor = createEditor()
  const page = editor.state.currentPageId
  const component = editor.graph.createNode('COMPONENT', page, { name: 'Button' })
  const text = editor.graph.createNode('TEXT', component.id, { text: 'Default' })
  const second = editor.graph.createNode('TEXT', component.id, { text: 'Other' })
  const firstInstance = editor.graph.createInstance(component.id, page)
  const secondInstance = editor.graph.createInstance(component.id, page)
  if (!firstInstance || !secondInstance) throw new Error('Missing instances')
  const propertyId = editor.exposeComponentProperty(text.id, 'TEXT', 'Label')
  if (!propertyId) throw new Error('Missing property')
  return { editor, page, component, text, second, firstInstance, secondInstance, propertyId }
}

describe('component property links and defaults', () => {
  test('linking adopts the default and preserves explicit instance assignments', async () => {
    const { editor, component, second, firstInstance, secondInstance, propertyId } = setup()
    editor.setInstanceComponentProperty(firstInstance.id, propertyId, 'Override')
    expect(editor.bindComponentProperty(second.id, 'TEXT', propertyId)).toBe(true)
    await Promise.resolve()
    expect(second.text).toBe('Default')
    expect(editor.graph.getChildren(firstInstance.id).map((node) => node.text)).toEqual([
      'Override',
      'Override'
    ])
    expect(editor.graph.getChildren(secondInstance.id).map((node) => node.text)).toEqual([
      'Default',
      'Default'
    ])
    expect(secondInstance.componentPropertyAssignments).toEqual({})
    expect(editor.setComponentPropertyDefault(component.id, propertyId, 'New default')).toBe(true)
    await Promise.resolve()
    expect(editor.graph.getChildren(firstInstance.id).map((node) => node.text)).toEqual([
      'Override',
      'Override'
    ])
    expect(editor.graph.getChildren(secondInstance.id).map((node) => node.text)).toEqual([
      'New default',
      'New default'
    ])
    editor.undo.undo()
    await Promise.resolve()
    expect(editor.graph.getChildren(secondInstance.id).map((node) => node.text)).toEqual([
      'Default',
      'Default'
    ])
    editor.undo.redo()
    await Promise.resolve()
    expect(second.text).toBe('New default')
  })

  test('retains an unbound definition for reuse and undoes a rebind', async () => {
    const { editor, component, text, second, propertyId } = setup()
    editor.bindComponentProperty(text.id, 'TEXT', null)
    expect(editor.getComponentPropertyBindings(component.id, propertyId)).toEqual([])
    expect(component.componentPropertyDefinitions[0]?.id).toBe(propertyId)
    editor.bindComponentProperty(second.id, 'TEXT', propertyId)
    await Promise.resolve()
    expect(second.text).toBe('Default')
    editor.undo.undo()
    await Promise.resolve()
    expect(second.componentPropertyReferences).toEqual([])
    expect(second.text).toBe('Other')
    const visible = editor.exposeComponentProperty(text.id, 'VISIBLE', 'Shown')
    expect(editor.bindComponentProperty(second.id, 'TEXT', visible)).toBe(false)
  })

  test('boolean defaults update sources and inheriting instances while respecting overrides', async () => {
    const { editor, component, text, firstInstance, secondInstance } = setup()
    const id = editor.exposeComponentProperty(text.id, 'VISIBLE', 'Shown')
    if (!id) throw new Error('Missing property')
    editor.setInstanceComponentProperty(firstInstance.id, id, 'true')
    expect(editor.setComponentPropertyDefault(component.id, id, 'false')).toBe(true)
    await Promise.resolve()
    expect(text.visible).toBe(false)
    expect(editor.graph.getChildren(firstInstance.id)[0]?.visible).toBe(true)
    expect(editor.graph.getChildren(secondInstance.id)[0]?.visible).toBe(false)
    expect(editor.setComponentPropertyDefault(component.id, id, 'invalid')).toBe(false)
  })

  test('swap defaults update nested sources and reject component cycles before mutation', async () => {
    const { editor, component, page } = setup()
    const a = editor.graph.createNode('COMPONENT', page, { name: 'A' })
    const b = editor.graph.createNode('COMPONENT', page, { name: 'B' })
    const icon = editor.graph.createInstance(a.id, component.id)
    if (!icon) throw new Error('Missing icon')
    const id = editor.exposeComponentProperty(icon.id, 'INSTANCE_SWAP', 'Icon')
    if (!id) throw new Error('Missing property')
    expect(editor.setComponentPropertyDefault(component.id, id, b.id)).toBe(true)
    await Promise.resolve()
    expect(icon.componentId).toBe(b.id)
    editor.undo.undo()
    await Promise.resolve()
    expect(icon.componentId).toBe(a.id)
    expect(editor.setComponentPropertyDefault(component.id, id, component.id)).toBe(false)
    expect(icon.componentId).toBe(a.id)
  })
})

test('creates an unbound definition, undoes creation, and links it later', async () => {
  const { editor, component, text } = setup()
  const id = editor.createComponentProperty(component.id, 'Independent', 'TEXT', 'Reusable')
  if (!id) throw new Error('Missing property')
  expect(editor.getComponentPropertyBindings(component.id, id)).toEqual([])
  editor.undo.undo()
  expect(component.componentPropertyDefinitions.some((item) => item.id === id)).toBe(false)
  editor.undo.redo()
  expect(editor.bindComponentProperty(text.id, 'TEXT', id)).toBe(true)
  await Promise.resolve()
  expect(text.text).toBe('Reusable')
  expect(editor.createComponentProperty(component.id, 'Independent', 'TEXT', '')).toBeNull()
  expect(editor.createComponentProperty(component.id, '', 'TEXT', '')).toBeNull()
  expect(editor.createComponentProperty(component.id, 'Bad boolean', 'BOOLEAN', 'yes')).toBeNull()
  expect(
    editor.createComponentProperty(component.id, 'Bad swap', 'INSTANCE_SWAP', 'missing')
  ).toBeNull()
  expect(editor.createComponentProperty(component.id, 'Variant', 'VARIANT', 'Primary')).toBeNull()
})
