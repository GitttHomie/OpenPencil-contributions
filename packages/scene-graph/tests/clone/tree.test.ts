import { describe, expect, test } from 'bun:test'

import { SceneGraph, getInstanceOverride, setInstanceOverride } from '@open-pencil/scene-graph'

import { expectDefined, getNodeOrThrow } from '../helpers/assert'

describe('SceneGraph.cloneTree', () => {
  test('copies nested override targets while retaining external definitions and literal strings', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const component = graph.createNode('COMPONENT', page.id)
    const source = graph.createNode('TEXT', component.id, { text: 'Default' })
    const frame = graph.createNode('FRAME', page.id)
    const owner = expectDefined(graph.createInstance(component.id, frame.id))
    const child = graph.getChildren(owner.id)[0]
    for (const [field, value] of [
      ['sourceComponentId', source.id],
      ['text', child.id],
      ['boundVariables/fontSize', 'font-size-variable']
    ]) {
      setInstanceOverride(owner.instanceOverrides, owner.id, child.id, field, value)
    }
    const before = structuredClone(owner.instanceOverrides)
    for (const copy of [
      expectDefined(graph.cloneTree(frame.id, page.id)),
      expectDefined(graph.cloneTree(frame.id, page.id))
    ]) {
      const copiedOwner = graph.getChildren(copy.id)[0]
      const copiedChild = graph.getChildren(copiedOwner.id)[0]
      expect([...copiedOwner.instanceOverrides.descendants.keys()]).toEqual([copiedChild.id])
      expect(copiedOwner.componentId).toBe(component.id)
      expect(copiedChild.componentId).toBe(source.id)
      expect(
        getInstanceOverride(
          copiedOwner.instanceOverrides,
          copiedOwner.id,
          copiedChild.id,
          'sourceComponentId'
        )
      ).toBe(source.id)
      expect(
        getInstanceOverride(copiedOwner.instanceOverrides, copiedOwner.id, copiedChild.id, 'text')
      ).toBe(child.id)
      expect(
        getInstanceOverride(
          copiedOwner.instanceOverrides,
          copiedOwner.id,
          copiedChild.id,
          'boundVariables/fontSize'
        )
      ).toBe('font-size-variable')
    }
    expect(owner.instanceOverrides).toEqual(before)
  })

  test('copies internal component references when the definition and instance are duplicated together', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const frame = graph.createNode('FRAME', page.id)
    const component = graph.createNode('COMPONENT', frame.id)
    const source = graph.createNode('RECTANGLE', component.id)
    graph.createInstance(component.id, frame.id)
    const copy = expectDefined(graph.cloneTree(frame.id, page.id))
    const [copiedComponent, copiedInstance] = graph.getChildren(copy.id)
    expect(copiedInstance.componentId).toBe(copiedComponent.id)
    const copiedSource = graph.getChildren(copiedComponent.id)[0]
    expect(graph.getChildren(copiedInstance.id)[0].componentId).toBe(copiedSource.id)
    graph.updateNode(copiedSource.id, { opacity: 0.5 })
    graph.syncInstances(copiedComponent.id)
    expect(graph.getChildren(copiedInstance.id)[0].opacity).toBe(0.5)
    expect(source.opacity).toBe(1)
  })

  test('clone clears source.id from the clone', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const rect = graph.createNode('RECTANGLE', page.id, {
      name: 'Original',
      width: 100,
      height: 50
    })
    // Simulate an imported node with a Figma source.id
    graph.updateNode(rect.id, {
      source: { ...rect.source, id: '1:42', orderKey: '!', format: 'fig' }
    })
    const original = getNodeOrThrow(graph, rect.id)
    expect(original).toBeDefined()
    expect(original.source.id).toBe('1:42')

    const clone = expectDefined(graph.cloneTree(rect.id, page.id), 'clone')
    expect(clone).not.toBeNull()
    // Clone must NOT carry the original's Figma GUID
    expect(clone.source.id).toBeNull()
    expect(clone.source.orderKey).toBeNull()
    // But format should be preserved
    expect(clone.source.format).toBe('fig')
  })

  test('clone of clone does not leak source.id', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const rect = graph.createNode('RECTANGLE', page.id, {
      name: 'Original',
      width: 100,
      height: 50
    })
    graph.updateNode(rect.id, {
      source: { ...rect.source, id: '1:99', format: 'fig' }
    })

    const clone1 = expectDefined(graph.cloneTree(rect.id, page.id), 'clone')
    expect(clone1).not.toBeNull()
    const clone2 = expectDefined(graph.cloneTree(clone1.id, page.id), 'clone')
    expect(clone2).not.toBeNull()
    expect(clone2.source.id).toBeNull()
  })

  test('clone preserves visual properties', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const rect = graph.createNode('RECTANGLE', page.id, {
      name: 'Original',
      width: 100,
      height: 50
    })
    graph.updateNode(rect.id, {
      source: { ...rect.source, id: '1:42', format: 'fig' },
      fills: [
        {
          type: 'SOLID',
          color: { r: 1, g: 0, b: 0, a: 1 },
          visible: true,
          opacity: 1,
          blendMode: 'NORMAL' as const
        }
      ]
    })

    const clone = expectDefined(graph.cloneTree(rect.id, page.id), 'clone')
    expect(clone).not.toBeNull()
    expect(clone.name).toBe('Original')
    expect(clone.width).toBe(100)
    expect(clone.height).toBe(50)
    expect(clone.fills).toEqual(rect.fills)
  })

  test('clone recursively clears source.id on children', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const frame = graph.createNode('FRAME', page.id, {
      name: 'Frame',
      width: 200,
      height: 200
    })
    graph.updateNode(frame.id, {
      source: { ...frame.source, id: '2:10', format: 'fig' }
    })
    const child = graph.createNode('RECTANGLE', frame.id, {
      name: 'Child',
      width: 50,
      height: 50
    })
    graph.updateNode(child.id, {
      source: { ...child.source, id: '2:11', format: 'fig' }
    })

    const clone = expectDefined(graph.cloneTree(frame.id, page.id), 'clone')
    expect(clone).not.toBeNull()
    expect(clone.source.id).toBeNull()
    const clonedChild = graph.getChildren(clone.id)[0]
    expect(clonedChild.source.id).toBeNull()
  })
  test('clone deep-copies source.fig so mutations do not affect original', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const rect = graph.createNode('RECTANGLE', page.id, {
      name: 'Original',
      width: 100,
      height: 50
    })
    graph.updateNode(rect.id, {
      source: {
        ...rect.source,
        id: '1:42',
        orderKey: '!',
        format: 'fig',
        fig: {
          rawSize: { x: 100, y: 50 },
          rawTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
          rawNodeFields: { visible: true, opacity: 1 },
          layout: null,
          symbolOverrides: [],
          componentPropAssignments: [],
          derivedSymbolData: [],
          derivedSymbolDataLayoutVersion: null,
          uniformScaleFactor: null
        }
      }
    })

    const original = getNodeOrThrow(graph, rect.id)
    expect(original.source.fig.rawNodeFields).toEqual({ visible: true, opacity: 1 })

    const clone = expectDefined(graph.cloneTree(rect.id, page.id), 'clone')
    expect(clone).not.toBeNull()

    // Mutate the clone's source.fig (simulating what clearEditedSourceMetadata does)
    clone.source.fig.rawNodeFields = {}
    clone.source.fig.rawSize = null

    // Original must be unaffected
    expect(original.source.fig.rawNodeFields).toEqual({ visible: true, opacity: 1 })
    expect(original.source.fig.rawSize).toEqual({ x: 100, y: 50 })
  })
})
