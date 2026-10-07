import { expect, test } from 'bun:test'

import * as v from 'valibot'

import { SceneGraph } from '@open-pencil/scene-graph'

import { createEditor } from '#core/editor'
import { FigmaAPI } from '#core/figma-api'
import { computeAllLayouts, setTextMeasurer } from '#core/layout'
import {
  bindComponentProperty,
  createComponentProperty,
  deleteComponentProperty,
  editComponentProperty,
  getComponentProperties,
  setInstanceProperties
} from '#core/tools/component-properties'
import {
  configureComponentSlot,
  createComponentSlot,
  resetInstanceSlot
} from '#core/tools/component-properties/slots'

const createdProperty = v.object({ property: v.object({ id: v.string() }) })

test('tools change and reset variant defaults without overwriting shared defaults or assignments', () => {
  const editor = createEditor()
  try {
    const figma = new FigmaAPI(editor.graph)
    const component = editor.graph.createNode('COMPONENT', editor.state.currentPageId, {
      name: 'Button'
    })
    const label = editor.graph.createNode('TEXT', component.id, { name: 'Label', text: 'Base' })
    const propertyId = editor.exposeComponentProperty(label.id, 'TEXT', 'Label')
    const variantId = editor.addVariant(component.id)
    if (!propertyId || !variantId || !component.parentId) throw new Error('Missing variants')
    const owner_id = component.parentId
    editComponentProperty.execute(figma, {
      owner_id,
      property_id: propertyId,
      variant_id: variantId,
      default_value: 'Variant'
    })
    editComponentProperty.execute(figma, {
      owner_id,
      property_id: propertyId,
      default_value: 'Shared'
    })
    expect(editor.graph.getChildren(variantId)[0].text).toBe('Variant')
    expect(label.text).toBe('Shared')
    editComponentProperty.execute(figma, {
      owner_id,
      property_id: propertyId,
      variant_id: variantId,
      reset_variant_default: true
    })
    expect(editor.graph.getChildren(variantId)[0].text).toBe('Shared')
  } finally {
    editor.dispose()
  }
})

function setup(graph = new SceneGraph()) {
  const figma = new FigmaAPI(graph)
  const component = graph.createNode('COMPONENT', figma.currentPageId, {
    name: 'Button',
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'HUG',
    paddingLeft: 8,
    paddingRight: 8
  })
  const label = graph.createNode('TEXT', component.id, {
    name: 'Label',
    text: 'Go',
    textAutoResize: 'WIDTH_AND_HEIGHT'
  })
  const instance = graph.createInstance(component.id, figma.currentPageId)
  if (!instance) throw new Error('Missing instance')
  const result = createComponentProperty.execute(figma, {
    owner_id: component.id,
    name: 'Label',
    type: 'TEXT',
    default_value: 'Go'
  })
  const propertyId = v.parse(createdProperty, result).property.id
  bindComponentProperty.execute(figma, { id: label.id, field: 'TEXT', property_id: propertyId })
  return { graph, figma, component, label, instance, propertyId }
}

test('property authoring updates existing instances, reuses definitions and preserves overrides', () => {
  const { graph, figma, component, label, instance, propertyId } = setup()
  const second = graph.createNode('TEXT', component.id, {
    name: 'Secondary',
    text: 'Second',
    textAutoResize: 'NONE',
    width: 120,
    height: 24
  })
  setInstanceProperties.execute(figma, {
    id: instance.id,
    values: { [propertyId]: 'Custom label' }
  })
  bindComponentProperty.execute(figma, { id: second.id, field: 'TEXT', property_id: propertyId })
  expect(graph.getChildren(instance.id).map((node) => node.text)).toEqual([
    'Custom label',
    'Custom label'
  ])
  editComponentProperty.execute(figma, {
    owner_id: component.id,
    property_id: propertyId,
    default_value: 'New default'
  })
  expect(label.text).toBe('New default')
  expect(second.text).toBe('New default')
  expect(second.textAutoResize).toBe('NONE')
  expect(second.width).toBe(120)
  expect(graph.getChildren(instance.id).map((node) => node.text)).toEqual([
    'Custom label',
    'Custom label'
  ])
  expect(getComponentProperties.execute(figma, { id: instance.id })).toMatchObject({
    owner_ids: [component.id],
    properties: [
      {
        id: propertyId,
        value: 'Custom label',
        overridden: true,
        bindings: [{ node_id: label.id }, { node_id: second.id }]
      }
    ]
  })
  bindComponentProperty.execute(figma, { id: second.id, field: 'TEXT', property_id: null })
  expect(second.componentPropertyReferences).toEqual([])
  expect(second.text).toBe('New default')
  deleteComponentProperty.execute(figma, { owner_id: component.id, property_id: propertyId })
  expect(component.componentPropertyDefinitions).toEqual([])
  expect(label.componentPropertyReferences).toEqual([])
  expect(instance.componentPropertyAssignments).toEqual({})
  expect(graph.getNode(second.id)).toBeDefined()
})

test('instance text overrides resize Hug layouts without changing fixed text sizing', async () => {
  const editor = createEditor()
  setTextMeasurer((node, maxWidth) => ({ width: maxWidth ?? node.text.length * 8, height: 16 }))
  try {
    const { graph, figma, component, label, instance, propertyId } = setup(editor.graph)
    computeAllLayouts(graph)
    const originalWidth = instance.width
    setInstanceProperties.execute(figma, {
      id: instance.id,
      values: { [propertyId]: 'A much longer button label' }
    })
    await Promise.resolve()
    computeAllLayouts(graph)
    expect(instance.width).toBeGreaterThan(originalWidth)
    expect(component.width).toBeLessThan(instance.width)
    expect(label.text).toBe('Go')
    graph.updateNode(label.id, { textAutoResize: 'NONE', width: 120, height: 24 })
    graph.syncInstances(component.id)
    setInstanceProperties.execute(figma, { id: instance.id, values: { [propertyId]: 'Short' } })
    const child = graph.getChildren(instance.id)[0]
    expect(child.textAutoResize).toBe('NONE')
    expect(child.width).toBe(120)
  } finally {
    editor.dispose()
    setTextMeasurer(null)
  }
})

test('invalid property values and incompatible bindings fail before mutating', () => {
  const { graph, figma, component, label, instance, propertyId } = setup()
  const booleanId = v.parse(
    createdProperty,
    createComponentProperty.execute(figma, {
      owner_id: component.id,
      name: 'Show',
      type: 'BOOLEAN',
      default_value: true
    })
  ).property.id
  const before = structuredClone([...graph.nodes.values()])
  expect(() =>
    bindComponentProperty.execute(figma, {
      id: label.id,
      field: 'TEXT',
      property_id: booleanId
    })
  ).toThrow()
  expect(() =>
    setInstanceProperties.execute(figma, {
      id: instance.id,
      values: { [propertyId]: 'Must not apply', [booleanId]: 'maybe' }
    })
  ).toThrow()
  expect(() =>
    bindComponentProperty.execute(figma, {
      id: graph.getChildren(instance.id)[0].id,
      field: 'TEXT',
      property_id: propertyId
    })
  ).toThrow()
  expect([...graph.nodes.values()]).toEqual(before)
})

test('visibility and nested swaps override one instance and recursive defaults are rejected', () => {
  const { graph, figma, component, label, instance } = setup()
  const first = graph.createNode('COMPONENT', figma.currentPageId, { name: 'First icon' })
  const second = graph.createNode('COMPONENT', figma.currentPageId, { name: 'Second icon' })
  const icon = graph.createInstance(first.id, component.id)
  if (!icon) throw new Error('Missing nested instance')
  const showId = v.parse(
    createdProperty,
    createComponentProperty.execute(figma, {
      owner_id: component.id,
      name: 'Show label',
      type: 'BOOLEAN',
      default_value: true
    })
  ).property.id
  const swapId = v.parse(
    createdProperty,
    createComponentProperty.execute(figma, {
      owner_id: component.id,
      name: 'Icon',
      type: 'INSTANCE_SWAP',
      default_value: first.id
    })
  ).property.id
  bindComponentProperty.execute(figma, { id: label.id, field: 'VISIBLE', property_id: showId })
  bindComponentProperty.execute(figma, { id: icon.id, field: 'INSTANCE_SWAP', property_id: swapId })
  setInstanceProperties.execute(figma, {
    id: instance.id,
    values: { [showId]: false, [swapId]: second.id }
  })
  expect(graph.getChildren(instance.id).find((node) => node.type === 'TEXT')?.visible).toBe(false)
  expect(graph.getChildren(instance.id).find((node) => node.type === 'INSTANCE')?.componentId).toBe(
    second.id
  )
  expect(label.visible).toBe(true)
  expect(icon.componentId).toBe(first.id)
  const before = structuredClone([...graph.nodes.values()])
  expect(() =>
    editComponentProperty.execute(figma, {
      owner_id: component.id,
      property_id: swapId,
      default_value: component.id
    })
  ).toThrow()
  expect([...graph.nodes.values()]).toEqual(before)
})

test('slot tools preserve default children, report their binding and restore customized instance content', () => {
  const { graph, figma, component, instance } = setup()
  const frame = graph.createNode('FRAME', component.id, { name: 'Actions' })
  graph.createNode('TEXT', frame.id, { name: 'Default', text: 'Default' })
  const propertyId = v.parse(createdProperty, createComponentSlot.execute(figma, { id: frame.id }))
    .property.id
  configureComponentSlot.execute(figma, {
    owner_id: component.id,
    property_id: propertyId,
    min_children: 1,
    max_children: 2,
    stretch_child: true
  })
  expect(getComponentProperties.execute(figma, { id: component.id })).toMatchObject({
    properties: expect.arrayContaining([
      expect.objectContaining({
        id: propertyId,
        type: 'SLOT',
        slotSettings: expect.objectContaining({ minChildren: 1, maxChildren: 2 }),
        bindings: [{ node_id: frame.id, name: 'Actions', field: 'SLOT_CONTENT' }]
      })
    ])
  })
  const slot = graph.getChildren(instance.id).find((node) => node.name === 'Actions')
  if (!slot) throw new Error('Missing instance slot')
  const extra = figma.createFrame()
  figma.getNodeById(slot.id)?.appendChild(extra)
  expect(graph.getChildren(slot.id)).toHaveLength(2)
  resetInstanceSlot.execute(figma, { id: slot.id })
  expect(graph.getChildren(slot.id).map((node) => node.name)).toEqual(['Default'])
  expect(() =>
    configureComponentSlot.execute(figma, {
      owner_id: component.id,
      property_id: propertyId,
      max_children: 0
    })
  ).toThrow('min_children')
  configureComponentSlot.execute(figma, {
    owner_id: component.id,
    property_id: propertyId,
    min_children: null,
    max_children: null
  })
  expect(
    component.componentPropertyDefinitions.find((definition) => definition.id === propertyId)
      ?.slotSettings?.minChildren
  ).toBeUndefined()
})
