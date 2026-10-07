import { expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { buildLayerTreeModel } from '#vue/primitives/LayerTree/model'

test('layer models include inherited component context and refresh after moving a subtree', () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const component = graph.createNode('COMPONENT', page.id)
  const frame = graph.createNode('FRAME', component.id)
  const text = graph.createNode('TEXT', frame.id)
  let model = buildLayerTreeModel(graph, page.id)
  expect(model.byId.get(text.id)?.component).toBe(true)
  graph.reparentNode(frame.id, page.id)
  model = buildLayerTreeModel(graph, page.id)
  expect(model.byId.get(text.id)?.component).toBe(false)
  expect(model.byId.get(component.id)?.component).toBe(true)
})
