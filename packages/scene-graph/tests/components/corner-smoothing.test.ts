import { expect, test } from 'bun:test'

import { recordInstanceOverride, SceneGraph } from '@open-pencil/scene-graph'

import { expectDefined } from '../helpers/assert'

test('corner smoothing is inherited on creation and sync, with independent root and child overrides', () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const component = graph.createNode('COMPONENT', page, { cornerRadius: 32, cornerSmoothing: 0.6 })
  const child = graph.createNode('RECTANGLE', component.id, {
    cornerRadius: 20,
    cornerSmoothing: 0.7
  })
  const instance = expectDefined(graph.createInstance(component.id, page))
  const clone = graph.getChildren(instance.id)[0]
  expect(instance.cornerSmoothing).toBe(0.6)
  expect(clone.cornerSmoothing).toBe(0.7)
  graph.updateNode(component.id, { cornerSmoothing: 1 })
  graph.updateNode(child.id, { cornerSmoothing: 0.9 })
  graph.syncInstances(component.id)
  expect(instance.cornerSmoothing).toBe(1)
  expect(clone.cornerSmoothing).toBe(0.9)

  graph.updateNode(instance.id, { cornerSmoothing: 0.2 })
  recordInstanceOverride(graph, instance.id, ['cornerSmoothing'])
  graph.updateNode(clone.id, { cornerSmoothing: 0.3 })
  recordInstanceOverride(graph, clone.id, ['cornerSmoothing'])
  graph.updateNode(component.id, { cornerSmoothing: 0.8, cornerRadius: 40 })
  graph.updateNode(child.id, { cornerSmoothing: 0.8, cornerRadius: 30 })
  graph.syncInstances(component.id)
  expect(instance).toMatchObject({ cornerSmoothing: 0.2, cornerRadius: 40 })
  expect(clone).toMatchObject({ cornerSmoothing: 0.3, cornerRadius: 30 })
})
