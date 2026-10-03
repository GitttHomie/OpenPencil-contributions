import { expect, test } from 'bun:test'

import dedent from 'dedent'
import * as v from 'valibot'

import { SceneGraph } from '@open-pencil/scene-graph'

import { FigmaAPI } from '#core/figma-api'
import { computeAllLayouts } from '#core/layout'
import { ALL_TOOLS } from '#core/tools/registry'

test('the guided tool workflow creates bound components and linked, resizable instances', async () => {
  const graph = new SceneGraph()
  const figma = new FigmaAPI(graph)
  async function call(name: string, args: Record<string, unknown>) {
    const tool = ALL_TOOLS.find((candidate) => candidate.name === name)
    if (!tool) throw new Error(`Missing tool: ${name}`)
    return tool.execute(figma, args)
  }
  const resultId = v.object({ id: v.string() })
  const collection = v.parse(
    v.object({ id: v.string(), defaultModeId: v.string() }),
    await call('create_collection', { name: 'Foundation' })
  )
  const space = v.parse(
    resultId,
    await call('create_variable', {
      collection_id: collection.id,
      name: 'Space/control',
      type: 'FLOAT',
      value: '12'
    })
  )
  const component = v.parse(
    resultId,
    await call('render', {
      jsx: dedent`<Component name="Status" flex="col" w={120} h="hug" p={designVar('${space.id}')} rounded={8}>
        <Rectangle name="Indicator" w={24} h={24} bg="#245B43" />
      </Component>`
    })
  )
  const screen = v.parse(
    resultId,
    await call('render', {
      jsx: dedent`<Frame name="Statuses" w={320} h="hug" flex="col" gap={16}>
        <Instance of="${component.id}" name="First" w="fill" />
        <Instance of="${component.id}" name="Second" w="fill" />
      </Frame>`
    })
  )
  const parent = graph.getNode(screen.id)
  if (!parent) throw new Error('Missing screen')
  const instances = parent.childIds.map((id) => {
    const node = graph.getNode(id)
    if (!node) throw new Error('Missing instance')
    return node
  })
  expect(instances).toHaveLength(2)
  for (const instance of instances) {
    expect(instance.type).toBe('INSTANCE')
    expect(instance.componentId).toBe(component.id)
    expect(instance.boundVariables.paddingLeft).toBe(space.id)
    expect(instance.width).toBe(320)
    expect(instance.height).toBe(48)
  }

  await call('set_variable', { id: space.id, mode: collection.defaultModeId, value: '20' })
  await call('set_radius', { id: component.id, radius: 16 })
  graph.syncInstances(component.id)
  await call('node_resize', { id: screen.id, width: 200, height: parent.height })
  computeAllLayouts(graph)

  for (const instance of instances) {
    expect(instance.paddingLeft).toBe(20)
    expect(instance.height).toBe(64)
    expect(instance.cornerRadius).toBe(16)
    expect(instance.width).toBe(200)
    expect(instance.componentId).toBe(component.id)
  }
})
