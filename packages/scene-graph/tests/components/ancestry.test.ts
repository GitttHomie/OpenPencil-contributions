import { expect, test } from 'bun:test'

import { isInComponent, SceneGraph } from '@open-pencil/scene-graph'

test('component ancestry follows reparenting and detachment without changing artwork', () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const component = graph.createNode('COMPONENT', page.id)
  const frame = graph.createNode('FRAME', component.id)
  const text = graph.createNode('TEXT', frame.id, { text: 'Label' })
  expect(isInComponent(graph, text.id)).toBe(true)
  expect(isInComponent(graph, frame.id)).toBe(true)
  graph.reparentNode(frame.id, page.id)
  expect(isInComponent(graph, text.id)).toBe(false)
  graph.reparentNode(frame.id, component.id)
  expect(isInComponent(graph, text.id)).toBe(true)
  graph.updateNode(component.id, { type: 'FRAME' })
  expect(isInComponent(graph, text.id)).toBe(false)
  expect(text.text).toBe('Label')
  expect(isInComponent(graph, 'missing')).toBe(false)
})

test.each(['COMPONENT_SET', 'COMPONENT', 'INSTANCE'] as const)(
  '%s and nested layers share component ancestry',
  (type) => {
    const graph = new SceneGraph()
    const root = graph.createNode(type, graph.getPages()[0].id)
    const frame = graph.createNode('FRAME', root.id)
    const rectangle = graph.createNode('RECTANGLE', frame.id)
    expect(isInComponent(graph, root.id)).toBe(true)
    expect(isInComponent(graph, rectangle.id)).toBe(true)
  }
)
