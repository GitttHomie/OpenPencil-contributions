import { expect, test } from 'bun:test'

import { canCreateInstance, SceneGraph } from '@open-pencil/scene-graph'

import { expectDefined } from '../helpers/assert'

test('instance creation and swapping reject direct and transitive component cycles without mutation', () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const a = graph.createNode('COMPONENT', page)
  const b = graph.createNode('COMPONENT', page)
  const c = graph.createNode('COMPONENT', page)
  const child = graph.createNode('FRAME', a.id)
  expect(graph.createInstance(a.id, a.id)).toBeNull()
  expect(graph.createInstance(a.id, child.id)).toBeNull()
  expectDefined(graph.createInstance(b.id, a.id))
  expectDefined(graph.createInstance(c.id, b.id))
  const target = expectDefined(graph.createInstance(c.id, page))
  const before = structuredClone([...graph.nodes])
  expect(canCreateInstance(graph, a.id, c.id)).toBe(false)
  expect(graph.createInstance(a.id, c.id)).toBeNull()
  const nested = expectDefined(graph.createInstance(c.id, a.id))
  const beforeSwap = structuredClone(nested)
  graph.swapInstanceComponent(nested.id, a.id)
  expect(nested).toEqual(beforeSwap)
  graph.deleteNode(nested.id)
  expect([...graph.nodes]).toEqual(before)
  graph.swapInstanceComponent(target.id, a.id)
  expect(target.componentId).toBe(a.id)
})
