import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'

function setup() {
  const editor = createEditor()
  const pageId = editor.state.currentPageId
  const component = editor.graph.createNode('COMPONENT', pageId, { name: 'Button' })
  const label = editor.graph.createNode('TEXT', component.id, { name: 'Label', text: 'Button' })
  const badge = editor.graph.createNode('FRAME', component.id, { name: 'Badge' })
  const instance = editor.graph.createInstance(component.id, pageId)
  if (!instance) throw new Error('Expected instance')
  return { editor, pageId, component, label, badge, instance }
}

function defined<T>(value: T | null | undefined): T {
  if (value == null) throw new Error('Expected value')
  return value
}

describe('manual component property authoring', () => {
  test('enables properties once with unique names and renames without replacing their identity', () => {
    const { editor, label, component } = setup()
    const first = defined(editor.enableComponentProperty(label.id, 'TEXT', 'Label'))
    expect(editor.enableComponentProperty(label.id, 'TEXT', 'Label')).toBe(first)
    const other = editor.graph.createNode('TEXT', component.id, { name: 'Label' })
    const second = defined(editor.enableComponentProperty(other.id, 'TEXT', 'Label'))
    expect(component.componentPropertyDefinitions.map((item) => item.name)).toEqual([
      'Label',
      'Label 2'
    ])
    expect(editor.renameComponentProperty(component.id, second, 'Secondary label')).toBe(true)
    expect(component.componentPropertyDefinitions.map((item) => item.id)).toEqual([first, second])
    expect(component.componentPropertyDefinitions.map((item) => item.name)).toEqual([
      'Label',
      'Secondary label'
    ])
    editor.undo.undo()
    expect(component.componentPropertyDefinitions.map((item) => item.id)).toEqual([first, second])
    expect(component.componentPropertyDefinitions.map((item) => item.name)).toEqual([
      'Label',
      'Label 2'
    ])
    expect(other.componentPropertyReferences).toEqual([{ propertyId: second, field: 'TEXT' }])
  })
  test('exposes a text property in one undo entry and applies it to existing instances', async () => {
    const { editor, component, label, instance } = setup()
    await Promise.resolve()
    editor.undo.clear()
    const id = defined(editor.exposeComponentProperty(label.id, 'TEXT', 'Label'))
    expect(component.componentPropertyDefinitions).toEqual([
      { id, name: 'Label', type: 'TEXT', defaultValue: 'Button' }
    ])
    expect(label.componentPropertyReferences).toEqual([{ propertyId: id, field: 'TEXT' }])
    editor.undo.undo()
    expect(label.componentPropertyReferences).toEqual([])
    expect(component.componentPropertyDefinitions).toEqual([])
    expect(editor.undo.undo()).toBeNull()
    editor.undo.redo()
    editor.setInstanceComponentProperty(instance.id, id, 'Buy now')
    expect(editor.graph.getChildren(instance.id).find((node) => node.name === 'Label')?.text).toBe(
      'Buy now'
    )
    expect(label.text).toBe('Button')
  })

  test('shares set properties across variants and preserves assignments on variant changes', async () => {
    const { editor, pageId, component, label, instance } = setup()
    const set = editor.graph.createNode('COMPONENT_SET', pageId, { name: 'Buttons' })
    editor.graph.reparentNode(component.id, set.id)
    const other = editor.graph.createNode('COMPONENT', set.id, { name: 'Secondary' })
    const otherLabel = editor.graph.createNode('TEXT', other.id, { text: 'Secondary' })
    const id = defined(editor.exposeComponentProperty(label.id, 'TEXT', 'Label'))
    expect(set.componentPropertyDefinitions[0]?.id).toBe(id)
    expect(editor.bindComponentProperty(otherLabel.id, 'TEXT', id)).toBe(true)
    editor.addPropertyDefinition(set.id, 'Style', 'VARIANT', 'Primary')
    const variantProperty = defined(
      set.componentPropertyDefinitions.find((item) => item.type === 'VARIANT')
    )
    editor.setVariantPropertyValue(other.id, variantProperty.id, 'Secondary')
    editor.setInstanceComponentProperty(instance.id, id, 'Custom label')
    editor.setInstanceComponentProperty(instance.id, variantProperty.id, 'Secondary')
    await Promise.resolve()
    expect(instance.componentId).toBe(other.id)
    expect(editor.graph.getChildren(instance.id)[0]?.text).toBe('Custom label')
  })

  test('binds multiple layers to one default and restores that value on instance undo', async () => {
    const { editor, component, label, instance } = setup()
    const second = editor.graph.createNode('TEXT', component.id, { name: 'Second', text: 'Second' })
    await Promise.resolve()
    const id = defined(editor.exposeComponentProperty(label.id, 'TEXT', 'Label'))
    editor.bindComponentProperty(second.id, 'TEXT', id)
    editor.setInstanceComponentProperty(instance.id, id, 'Together')
    expect(
      editor.graph
        .getChildren(instance.id)
        .filter((node) => node.type === 'TEXT')
        .map((node) => node.text)
    ).toEqual(['Together', 'Together'])
    editor.undo.undo()
    expect(
      editor.graph
        .getChildren(instance.id)
        .filter((node) => node.type === 'TEXT')
        .map((node) => node.text)
    ).toEqual(['Button', 'Button'])
    editor.undo.redo()
    expect(
      editor.graph
        .getChildren(instance.id)
        .filter((node) => node.type === 'TEXT')
        .map((node) => node.text)
    ).toEqual(['Together', 'Together'])
  })

  test('applies an existing assignment when another layer is bound and undoes that binding', async () => {
    const { editor, component, label, instance } = setup()
    const second = editor.graph.createNode('TEXT', component.id, { name: 'Second', text: 'Second' })
    await Promise.resolve()
    const id = defined(editor.exposeComponentProperty(label.id, 'TEXT', 'Label'))
    editor.setInstanceComponentProperty(instance.id, id, 'Custom')
    editor.bindComponentProperty(second.id, 'TEXT', id)
    expect(editor.graph.getChildren(instance.id).find((node) => node.name === 'Second')?.text).toBe(
      'Custom'
    )
    editor.undo.undo()
    await Promise.resolve()
    expect(second.componentPropertyReferences).toEqual([])
    expect(editor.graph.getChildren(instance.id).find((node) => node.name === 'Second')?.text).toBe(
      'Second'
    )
    expect(instance.componentPropertyAssignments[id]).toBe('Custom')
  })

  test('exposes visibility, renames without losing bindings, and deletes with undo', async () => {
    const { editor, component, badge, instance } = setup()
    const id = defined(editor.exposeComponentProperty(badge.id, 'VISIBLE', 'Show badge'))
    editor.setInstanceComponentProperty(instance.id, id, 'false')
    expect(editor.renameComponentProperty(component.id, id, 'Badge visible')).toBe(true)
    expect(editor.getInstanceComponentPropertyDefinitions(instance.id)[0]?.name).toBe(
      'Badge visible'
    )
    expect(editor.getComponentPropertyBindings(component.id, id)).toEqual([
      { nodeId: badge.id, name: 'Badge', field: 'VISIBLE' }
    ])
    expect(editor.deleteComponentProperty(component.id, id)).toBe(true)
    expect(badge.componentPropertyReferences).toEqual([])
    expect(instance.componentPropertyAssignments).toEqual({})
    editor.undo.undo()
    await Promise.resolve()
    expect(instance.componentPropertyAssignments[id]).toBe('false')
    expect(badge.componentPropertyReferences).toEqual([{ propertyId: id, field: 'VISIBLE' }])
    expect(
      editor.graph.getChildren(instance.id).find((node) => node.name === 'Badge')?.visible
    ).toBe(false)
  })

  test('exposes nested swaps while rejecting authoring inside instance descendants', async () => {
    const { editor, pageId, component, label, instance } = setup()
    const icon = editor.graph.createNode('COMPONENT', pageId, { name: 'Icon' })
    editor.graph.createNode('TEXT', icon.id, { text: 'Icon' })
    const otherIcon = editor.graph.createNode('COMPONENT', pageId, { name: 'Other icon' })
    const nested = defined(editor.graph.createInstance(icon.id, component.id))
    await Promise.resolve()
    const id = defined(editor.exposeComponentProperty(nested.id, 'INSTANCE_SWAP', 'Icon'))
    editor.setInstanceComponentProperty(instance.id, id, otherIcon.id)
    expect(
      editor.graph.getChildren(instance.id).find((node) => node.type === 'INSTANCE')?.componentId
    ).toBe(otherIcon.id)
    editor.undo.undo()
    expect(
      editor.graph.getChildren(instance.id).find((node) => node.type === 'INSTANCE')?.componentId
    ).toBe(icon.id)
    const inherited = defined(
      editor.graph.getChildren(instance.id).find((node) => node.name === label.name)
    )
    expect(editor.getComponentPropertyAuthoring(inherited.id)).toBeNull()
    expect(
      editor.getComponentPropertyAuthoring(defined(editor.graph.getChildren(nested.id)[0]).id)
    ).toBeNull()
    expect(editor.exposeComponentProperty(inherited.id, 'TEXT', 'Wrong owner')).toBeNull()
    expect(editor.exposeComponentProperty(component.id, 'VISIBLE', 'Root')).toBeNull()
    expect(editor.bindComponentProperty(label.id, 'TEXT', id)).toBe(false)
  })

  test('rejects empty and duplicate names and does not record invalid mutations', async () => {
    const { editor, component, label, badge } = setup()
    await Promise.resolve()
    const id = defined(editor.exposeComponentProperty(label.id, 'TEXT', 'Label'))
    editor.undo.clear()
    expect(editor.exposeComponentProperty(badge.id, 'VISIBLE', '  ')).toBeNull()
    expect(editor.exposeComponentProperty(badge.id, 'VISIBLE', 'Label')).toBeNull()
    expect(editor.renameComponentProperty(component.id, id, ' ')).toBe(false)
    expect(editor.bindComponentProperty(badge.id, 'TEXT', id)).toBe(false)
    expect(editor.undo.undo()).toBeNull()
  })

  test('keeps library property definitions read-only while allowing instance edits', () => {
    const { editor, component, label, instance } = setup()
    const id = defined(editor.exposeComponentProperty(label.id, 'TEXT', 'Label'))
    editor.graph.updateNode(component.id, {
      librarySource: {
        identity: { libraryId: 'shared', assetKey: 'button', revisionId: 'r1' },
        sourceNodeId: 'source-button',
        readOnly: true
      }
    })
    expect(editor.getComponentPropertyAuthoring(label.id)?.editable).toBe(false)
    expect(() => editor.exposeComponentProperty(label.id, 'VISIBLE', 'Show label')).toThrow()
    expect(() => editor.bindComponentProperty(label.id, 'TEXT', null)).toThrow()
    expect(() => editor.renameComponentProperty(component.id, id, 'Changed')).toThrow()
    expect(() => editor.deleteComponentProperty(component.id, id)).toThrow()
    editor.setInstanceComponentProperty(instance.id, id, 'Allowed')
    expect(instance.componentPropertyAssignments[id]).toBe('Allowed')
  })

  test('rejects shared names that collide with a property owned by another variant', () => {
    const { editor, pageId, component, label } = setup()
    const localId = defined(editor.exposeComponentProperty(label.id, 'TEXT', 'Local label'))
    const set = editor.graph.createNode('COMPONENT_SET', pageId)
    editor.graph.reparentNode(component.id, set.id)
    const other = editor.graph.createNode('COMPONENT', set.id)
    const text = editor.graph.createNode('TEXT', other.id)
    expect(editor.exposeComponentProperty(text.id, 'TEXT', 'Local label')).toBeNull()
    const sharedId = defined(editor.exposeComponentProperty(text.id, 'TEXT', 'Shared label'))
    expect(editor.renameComponentProperty(set.id, sharedId, 'Local label')).toBe(false)
    expect(editor.renameComponentProperty(component.id, localId, 'Shared label')).toBe(false)
  })
})
