import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'

function setupVariants() {
  const editor = createEditor()
  const pageId = editor.state.currentPageId
  const componentSet = editor.graph.createNode('COMPONENT_SET', pageId, {
    name: 'Button',
    componentPropertyDefinitions: [
      {
        id: 'variant:type',
        name: 'Type',
        type: 'VARIANT',
        defaultValue: 'Primary',
        variantOptions: ['Primary', 'Secondary']
      },
      {
        id: 'variant:size',
        name: 'Size',
        type: 'VARIANT',
        defaultValue: 'Small',
        variantOptions: ['Small', 'Large']
      }
    ]
  })
  const createVariant = (type: string, size: string, x: number, y: number) =>
    editor.graph.createNode('COMPONENT', componentSet.id, {
      name: `Type=${type}, Size=${size}`,
      x,
      y,
      componentPropertyValues: { Type: type, Size: size }
    })
  const primarySmall = createVariant('Primary', 'Small', 0, 0)
  const primaryLarge = createVariant('Primary', 'Large', 140, 0)
  const secondarySmall = createVariant('Secondary', 'Small', 0, 140)
  return { editor, componentSet, primarySmall, primaryLarge, secondarySmall }
}

describe('variant authoring', () => {
  for (const direction of ['HORIZONTAL', 'VERTICAL'] as const) {
    for (const sizing of ['HUG', 'FIXED'] as const) {
      test(`reflows ${direction} ${sizing} parents when variants grow, shrink, undo and redo`, async () => {
        const { editor, primarySmall, primaryLarge } = setupVariants()
        editor.graph.updateNode(primarySmall.id, { width: 80, height: 32 })
        editor.graph.updateNode(primaryLarge.id, { width: 160, height: 64 })
        const outer = editor.graph.createNode('FRAME', editor.state.currentPageId, {
          layoutMode: direction,
          primaryAxisSizing: 'HUG',
          counterAxisSizing: 'HUG',
          paddingLeft: 5,
          paddingRight: 5,
          paddingTop: 5,
          paddingBottom: 5
        })
        const parent = editor.graph.createNode('FRAME', outer.id, {
          width: 400,
          height: 300,
          layoutMode: direction,
          primaryAxisSizing: sizing,
          counterAxisSizing: sizing,
          itemSpacing: 12,
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 8,
          paddingBottom: 8
        })
        const first = editor.graph.createInstance(primarySmall.id, parent.id)
        const second = editor.graph.createInstance(primarySmall.id, parent.id)
        if (!first || !second) throw new Error('Expected instances')
        // Settle component creation before the edit so its scheduled layout cannot mask a bug.
        await Promise.resolve()
        editor.runLayoutForNode(parent.id)

        function expectLayout(large: boolean) {
          const width = large ? 160 : 80
          const height = large ? 64 : 32
          expect(first).toMatchObject({ width, height, x: 8, y: 8 })
          expect(second).toMatchObject({
            x: direction === 'HORIZONTAL' ? 8 + width + 12 : 8,
            y: direction === 'VERTICAL' ? 8 + height + 12 : 8
          })
          const parentWidth =
            sizing === 'FIXED' ? 400 : 16 + width + (direction === 'HORIZONTAL' ? 92 : 0)
          const parentHeight =
            sizing === 'FIXED' ? 300 : 16 + height + (direction === 'VERTICAL' ? 44 : 0)
          expect(parent).toMatchObject({ width: parentWidth, height: parentHeight })
          expect(outer).toMatchObject({ width: parentWidth + 10, height: parentHeight + 10 })
        }

        expectLayout(false)
        editor.setInstanceComponentProperty(first.id, 'variant:size', 'Large')
        expectLayout(true)
        await Promise.resolve()
        expectLayout(true)
        editor.undo.undo()
        expectLayout(false)
        editor.undo.redo()
        expectLayout(true)
        editor.setInstanceComponentProperty(first.id, 'variant:size', 'Small')
        expectLayout(false)
      })
    }
  }

  test('reflows around an explicitly resized instance without replacing its width override', async () => {
    const { editor, primarySmall, primaryLarge } = setupVariants()
    editor.graph.updateNode(primarySmall.id, { width: 80, height: 32 })
    editor.graph.updateNode(primaryLarge.id, { width: 160, height: 64 })
    const parent = editor.graph.createNode('FRAME', editor.state.currentPageId, {
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG',
      itemSpacing: 12
    })
    const first = editor.graph.createInstance(primarySmall.id, parent.id)
    const second = editor.graph.createInstance(primarySmall.id, parent.id)
    if (!first || !second) throw new Error('Expected instances')
    await Promise.resolve()
    editor.updateNodeWithUndo(first.id, { width: 120 })
    editor.setInstanceComponentProperty(first.id, 'variant:size', 'Large')
    expect(first).toMatchObject({ width: 120, height: 64 })
    expect(second.x).toBe(132)
    expect(parent).toMatchObject({ width: 212, height: 64 })
    editor.undo.undo()
    expect(first).toMatchObject({ width: 120, height: 32 })
    expect(parent).toMatchObject({ width: 212, height: 32 })
    editor.undo.redo()
    expect(parent).toMatchObject({ width: 212, height: 64 })
  })

  test('keeps sparse multidimensional transitions exact and reports unavailable combinations', () => {
    const { editor, primarySmall, primaryLarge } = setupVariants()
    const instance = editor.graph.createInstance(primarySmall.id, editor.state.currentPageId)
    if (!instance) throw new Error('Expected instance')

    expect(editor.getVariantOptionAvailability(instance.id, 'Size')).toEqual([
      { value: 'Small', available: true },
      { value: 'Large', available: true }
    ])
    expect(
      editor.setInstanceComponentProperty(instance.id, 'variant:size', 'Large')
    ).toBeUndefined()
    expect(editor.graph.getNode(instance.id)?.componentId).toBe(primaryLarge.id)

    expect(editor.getVariantOptionAvailability(instance.id, 'Type')).toEqual([
      { value: 'Primary', available: true },
      { value: 'Secondary', available: false }
    ])
    expect(editor.switchInstanceVariant(instance.id, 'Type', 'Secondary')).toEqual({
      kind: 'unavailable',
      requested: { Type: 'Secondary', Size: 'Large' }
    })
    expect(editor.graph.getNode(instance.id)?.componentId).toBe(primaryLarge.id)
  })

  test('renames dimensions and values atomically through undo and redo', () => {
    const { editor, componentSet, primarySmall } = setupVariants()

    expect(editor.renamePropertyDefinition(componentSet.id, 'variant:size', 'Density')).toBe(true)
    expect(editor.graph.getNode(primarySmall.id)?.componentPropertyValues).toEqual({
      Type: 'Primary',
      Density: 'Small'
    })
    expect(editor.graph.getNode(primarySmall.id)?.name).toBe('Type=Primary, Density=Small')

    editor.undo.undo()
    expect(editor.graph.getNode(primarySmall.id)?.componentPropertyValues).toEqual({
      Type: 'Primary',
      Size: 'Small'
    })
    expect(editor.graph.getNode(primarySmall.id)?.name).toBe('Type=Primary, Size=Small')

    editor.undo.redo()
    expect(editor.renameVariantValue(componentSet.id, 'variant:size', 'Small', 'Compact')).toBe(
      true
    )
    expect(editor.graph.getNode(primarySmall.id)?.componentPropertyValues.Density).toBe('Compact')
    expect(
      editor.graph
        .getNode(componentSet.id)
        ?.componentPropertyDefinitions.find((definition) => definition.id === 'variant:size')
        ?.variantOptions
    ).toEqual(['Compact', 'Large'])

    editor.undo.undo()
    expect(editor.graph.getNode(primarySmall.id)?.componentPropertyValues.Density).toBe('Small')
  })

  test('adds and removes dimensions with complete undo snapshots', () => {
    const { editor, componentSet, primarySmall } = setupVariants()
    const propertyId = editor.addPropertyDefinition(componentSet.id, 'State', 'VARIANT', 'Enabled')
    expect(propertyId).toStartWith('prop:')
    expect(editor.graph.getNode(primarySmall.id)?.componentPropertyValues.State).toBe('Enabled')

    editor.undo.undo()
    expect(editor.graph.getNode(primarySmall.id)?.componentPropertyValues).not.toHaveProperty(
      'State'
    )
    editor.undo.redo()
    expect(editor.graph.getNode(primarySmall.id)?.componentPropertyValues.State).toBe('Enabled')

    if (!propertyId) throw new Error('Expected property ID')
    expect(editor.removePropertyDefinition(componentSet.id, propertyId)).toBe(true)
    expect(editor.graph.getNode(primarySmall.id)?.componentPropertyValues).not.toHaveProperty(
      'State'
    )
    editor.undo.undo()
    expect(editor.graph.getNode(primarySmall.id)?.componentPropertyValues.State).toBe('Enabled')
  })

  test('reorders properties and values atomically', () => {
    const { editor, componentSet, primarySmall } = setupVariants()

    expect(
      editor.reorderPropertyDefinitions(componentSet.id, ['variant:size', 'variant:type'])
    ).toBe(true)
    expect(
      editor.graph
        .getNode(componentSet.id)
        ?.componentPropertyDefinitions.map((definition) => definition.id)
    ).toEqual(['variant:size', 'variant:type'])
    expect(editor.graph.getNode(primarySmall.id)?.name).toBe('Size=Small, Type=Primary')

    expect(editor.reorderVariantValues(componentSet.id, 'variant:size', ['Large', 'Small'])).toBe(
      true
    )
    expect(
      editor.graph
        .getNode(componentSet.id)
        ?.componentPropertyDefinitions.find((definition) => definition.id === 'variant:size')
    ).toMatchObject({ defaultValue: 'Large', variantOptions: ['Large', 'Small'] })

    editor.undo.undo()
    expect(
      editor.graph
        .getNode(componentSet.id)
        ?.componentPropertyDefinitions.find((definition) => definition.id === 'variant:size')
    ).toMatchObject({ defaultValue: 'Small', variantOptions: ['Small', 'Large'] })
    editor.undo.undo()
    expect(editor.graph.getNode(primarySmall.id)?.name).toBe('Type=Primary, Size=Small')
  })

  test('uses top-left defaults and validates missing or duplicate combinations', () => {
    const { editor, componentSet, primarySmall, primaryLarge } = setupVariants()
    const topLeft = editor.graph.getNode(primarySmall.id)
    const topRight = editor.graph.getNode(primaryLarge.id)
    if (!topLeft || !topRight) throw new Error('Expected variants')
    editor.graph.updateNode(topLeft.id, { x: 200, y: 200 })
    editor.graph.updateNode(topRight.id, { x: 0, y: 0 })
    expect(editor.getDefaultVariantForComponentSet(componentSet.id)?.id).toBe(primaryLarge.id)

    editor.graph.updateNode(primaryLarge.id, {
      componentPropertyValues: { Type: 'Primary', Size: '' }
    })
    expect(editor.validateComponentSet(componentSet.id)).toEqual([
      {
        kind: 'missing-value',
        propertyId: 'variant:size',
        propertyName: 'Size',
        componentIds: [primaryLarge.id]
      }
    ])
    editor.graph.updateNode(primaryLarge.id, {
      componentPropertyValues: { Type: 'Primary', Size: 'Small' }
    })
    expect(editor.validateComponentSet(componentSet.id)).toEqual([
      {
        kind: 'duplicate-combination',
        values: { Type: 'Primary', Size: 'Small' },
        componentIds: [primarySmall.id, primaryLarge.id]
      }
    ])
  })
  test('edits combinations, diagnoses conflicts, and duplicates or removes variants', () => {
    const { editor, componentSet, primarySmall, primaryLarge } = setupVariants()

    expect(editor.setVariantPropertyValue(primaryLarge.id, 'variant:size', 'Small')).toEqual({
      kind: 'conflict',
      componentIds: [primaryLarge.id, primarySmall.id]
    })
    expect(editor.getComponentSetVariantConflicts(componentSet.id)).toEqual([])
    expect(editor.graph.getNode(primaryLarge.id)?.componentPropertyValues.Size).toBe('Large')

    expect(editor.setVariantPropertyValue(primaryLarge.id, 'variant:size', 'Medium')).toEqual({
      kind: 'changed'
    })
    expect(editor.graph.getNode(primaryLarge.id)?.componentPropertyValues.Size).toBe('Medium')
    editor.undo.undo()
    expect(editor.graph.getNode(primaryLarge.id)?.componentPropertyValues.Size).toBe('Large')

    const duplicateId = editor.duplicateVariant(primarySmall.id)
    expect(duplicateId).toBeString()
    expect(editor.getComponentSetVariantConflicts(componentSet.id)).toHaveLength(0)
    editor.undo.undo()
    expect(duplicateId ? editor.graph.getNode(duplicateId) : undefined).toBeUndefined()
    editor.undo.redo()
    expect(duplicateId ? editor.graph.getNode(duplicateId)?.parentId : undefined).toBe(
      componentSet.id
    )

    if (!duplicateId) throw new Error('Expected duplicate')
    expect(editor.removeVariant(duplicateId)).toBe(true)
    expect(editor.graph.getNode(duplicateId)).toBeUndefined()
    editor.undo.undo()
    expect(editor.graph.getNode(duplicateId)?.parentId).toBe(componentSet.id)
  })
})
