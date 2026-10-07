import { expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { expectDefined } from '../helpers/assert'

test('variant instances use set names on creation and swapping while retaining custom names', () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const buttons = graph.createNode('COMPONENT_SET', page, { name: 'Button' })
  const base = graph.createNode('COMPONENT', buttons.id, { name: 'State=Base' })
  const hover = graph.createNode('COMPONENT', buttons.id, { name: 'State=Hover' })
  const toggles = graph.createNode('COMPONENT_SET', page, { name: 'Toggle' })
  const on = graph.createNode('COMPONENT', toggles.id, { name: 'State=On' })
  const standalone = graph.createNode('COMPONENT', page, { name: 'Icon' })

  const instance = expectDefined(graph.createInstance(hover.id, page))
  expect(instance).toMatchObject({ name: 'Button', componentId: hover.id })
  graph.swapInstanceComponent(instance.id, base.id)
  expect(instance).toMatchObject({ name: 'Button', componentId: base.id })
  graph.swapInstanceComponent(instance.id, on.id)
  expect(instance.name).toBe('Toggle')
  graph.swapInstanceComponent(instance.id, standalone.id)
  expect(instance.name).toBe('Icon')

  const renamed = expectDefined(graph.createInstance(base.id, page, { name: 'Submit order' }))
  graph.swapInstanceComponent(renamed.id, hover.id)
  graph.syncInstances(hover.id)
  expect(renamed.name).toBe('Submit order')
  const legacy = expectDefined(graph.createInstance(base.id, page, { name: base.name }))
  graph.swapInstanceComponent(legacy.id, hover.id)
  expect(legacy.name).toBe('Button')
})
