import { expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'

function setup() {
  const editor = createEditor()
  const set = editor.graph.createNode('COMPONENT_SET', editor.state.currentPageId, {
    name: 'Button',
    componentPropertyDefinitions: [
      {
        id: 'state',
        name: 'State',
        type: 'VARIANT',
        defaultValue: 'Base',
        variantOptions: ['Base', 'Hover']
      },
      {
        id: 'size',
        name: 'Size',
        type: 'VARIANT',
        defaultValue: 'Small',
        variantOptions: ['Small', 'Large']
      }
    ]
  })
  const base = editor.graph.createNode('COMPONENT', set.id, {
    name: 'State=Base, Size=Small',
    componentPropertyValues: { State: 'Base', Size: 'Small' }
  })
  const hover = editor.graph.createNode('COMPONENT', set.id, {
    name: 'State=Hover, Size=Small',
    componentPropertyValues: { State: 'Hover', Size: 'Small' }
  })
  return { editor, set, base, hover }
}

test('unused descriptor values are created, reordered and retained through edits and undo', () => {
  const { editor, set, base } = setup()
  try {
    expect(editor.addVariantValue(set.id, 'state', 'Disabled')).toBe(true)
    expect(editor.addVariantValue(set.id, 'state', 'Disabled')).toBe(false)
    editor.setVariantPropertyValue(base.id, 'size', 'Large')
    expect(editor.getVariantOptions(set.id, 'state')).toEqual(['Base', 'Hover', 'Disabled'])
    expect(editor.reorderVariantValues(set.id, 'state', ['Disabled', 'Hover', 'Base'])).toBe(true)
    expect(editor.getVariantOptions(set.id, 'state')).toEqual(['Disabled', 'Hover', 'Base'])
    editor.undo.undo()
    expect(editor.getVariantOptions(set.id, 'state')).toEqual(['Base', 'Hover', 'Disabled'])
    expect(editor.renameVariantValue(set.id, 'state', 'Disabled', 'Pressed')).toBe(true)
    expect(editor.removeVariantValue(set.id, 'state', 'Pressed')).toEqual({ kind: 'changed' })
    editor.undo.undo()
    expect(editor.getVariantOptions(set.id, 'state')).toEqual(['Base', 'Hover', 'Pressed'])
    expect(set.childIds).toHaveLength(2)
  } finally {
    editor.dispose()
  }
})

test('deleting an in-use value requires a replacement and rejects duplicate combinations atomically', () => {
  const { editor, set, base, hover } = setup()
  try {
    const before = structuredClone(set.componentPropertyDefinitions)
    expect(editor.removeVariantValue(set.id, 'state', 'Hover')).toEqual({ kind: 'invalid' })
    expect(editor.removeVariantValue(set.id, 'state', 'Hover', 'Base')).toEqual({
      kind: 'conflict',
      componentIds: [base.id, hover.id]
    })
    expect(set.componentPropertyDefinitions).toEqual(before)
    expect(hover.componentPropertyValues.State).toBe('Hover')
    editor.setVariantPropertyValue(hover.id, 'size', 'Large')
    expect(editor.removeVariantValue(set.id, 'state', 'Hover', 'Base')).toEqual({ kind: 'changed' })
    expect(hover.componentPropertyValues).toEqual({ State: 'Base', Size: 'Large' })
    expect(editor.getVariantOptions(set.id, 'state')).toEqual(['Base'])
    editor.undo.undo()
    expect(hover.componentPropertyValues.State).toBe('Hover')
    expect(editor.getVariantOptions(set.id, 'state')).toEqual(['Base', 'Hover'])
    expect(set.childIds).toHaveLength(2)
  } finally {
    editor.dispose()
  }
})

test('conflicts caused by removing a dimension identify both components and can be repaired', () => {
  const { editor, set, base, hover } = setup()
  try {
    editor.removePropertyDefinition(set.id, 'state')
    expect(editor.getComponentSetVariantConflicts(set.id)).toEqual([
      { values: { Size: 'Small' }, componentIds: [base.id, hover.id] }
    ])
    editor.setVariantPropertyValue(hover.id, 'size', 'Large')
    expect(editor.getComponentSetVariantConflicts(set.id)).toEqual([])
    editor.removePropertyDefinition(set.id, 'size')
    expect(base.name).toBe('Size=Small')
    expect(hover.name).toBe('Size=Large')
    expect(set.childIds).toHaveLength(2)
  } finally {
    editor.dispose()
  }
})

test('an instance lists unused descriptor values as unavailable rather than switching to an unrelated variant', () => {
  const { editor, set, base } = setup()
  try {
    editor.addVariantValue(set.id, 'state', 'Disabled')
    const instance = editor.graph.createInstance(base.id, editor.state.currentPageId)
    if (!instance) throw new Error('Missing instance')
    expect(editor.getVariantOptionAvailability(instance.id, 'State')).toEqual([
      { value: 'Base', available: true },
      { value: 'Hover', available: true },
      { value: 'Disabled', available: false }
    ])
    expect(editor.switchInstanceVariant(instance.id, 'State', 'Disabled').kind).toBe('unavailable')
    expect(instance.componentId).toBe(base.id)
  } finally {
    editor.dispose()
  }
})
