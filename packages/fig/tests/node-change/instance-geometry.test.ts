import { expect, test } from 'bun:test'

import type { DerivedSymbolOverride } from '#fig/instance-overrides/types'
import { snapshotInstanceGeometry } from '#fig/node-change/instance/geometry'

import { stringToGuid } from '@open-pencil/kiwi/fig/guid'
import { SceneGraph, setInstanceOverride } from '@open-pencil/scene-graph'

import { expectDefined } from '../helpers/assert'

function fixture() {
  const graph = new SceneGraph()
  const component = graph.createNode('COMPONENT', graph.getPages()[0].id)
  const source = graph.createNode('RECTANGLE', component.id, { width: 10, height: 20 })
  const owner = expectDefined(graph.createInstance(component.id, graph.getPages()[0].id))
  return { graph, source, owner }
}

test('geometry snapshots merge retained fields without authoring claims or mutating retained data', () => {
  const { graph, source, owner } = fixture()
  const guidPath = { guids: [stringToGuid(source.id)] }
  const retained: DerivedSymbolOverride[] = [
    { guidPath, fontSize: 12 },
    { guidPath, size: { x: 1, y: 1 } },
    { fontSize: 24 }
  ]
  const before = structuredClone(retained)
  const result = snapshotInstanceGeometry(graph, owner, stringToGuid, retained, (node) => ({
    size: { x: node.width, y: node.height }
  }))
  expect(result).toEqual([{ fontSize: 24 }, { guidPath, fontSize: 12, size: { x: 10, y: 20 } }])
  expect(retained).toEqual(before)
  expect(owner.instanceOverrides.self.size).toBe(0)
})

test('geometry snapshots reject ambiguous occurrence addresses', () => {
  const { graph, source, owner } = fixture()
  graph.createNode('RECTANGLE', owner.id, { componentId: source.id })
  expect(() =>
    snapshotInstanceGeometry(graph, owner, stringToGuid, [], (node) => ({
      size: { x: node.width, y: node.height }
    }))
  ).toThrow('Ambiguous instance geometry address')
})

test('duplicated imported instances keep distinct addresses for repeated nested components', () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const item = graph.createNode('COMPONENT', page.id)
  const label = graph.createNode('TEXT', item.id, { text: 'Item' })
  const component = graph.createNode('COMPONENT', page.id)
  const first = expectDefined(graph.createInstance(item.id, component.id))
  const second = expectDefined(graph.createInstance(item.id, component.id))
  const frame = graph.createNode('FRAME', page.id)
  const owner = graph.createNode('INSTANCE', frame.id, { componentId: component.id })
  // Imported occurrences name the main component, with correspondence stored separately.
  for (const [index, source] of [first, second].entries()) {
    const child = graph.createNode('INSTANCE', owner.id, {
      componentId: item.id,
      width: 40 + index * 20
    })
    graph.createNode('TEXT', child.id, { componentId: label.id, text: `Item ${index}` })
    setInstanceOverride(owner.instanceOverrides, owner.id, child.id, 'sourceComponentId', source.id)
  }
  const copy = expectDefined(graph.cloneTree(frame.id, page.id))
  const copiedOwner = graph.getChildren(copy.id)[0]
  const result = snapshotInstanceGeometry(graph, copiedOwner, stringToGuid, [], (node) => ({
    size: { x: node.width, y: node.height }
  }))
  expect(result.map((entry) => entry.guidPath?.guids)).toEqual([
    [stringToGuid(first.id)],
    [stringToGuid(first.id), stringToGuid(label.id)],
    [stringToGuid(second.id)],
    [stringToGuid(second.id), stringToGuid(label.id)]
  ])
  expect(result[0].size?.x).toBe(40)
  expect(result[2].size?.x).toBe(60)
})
