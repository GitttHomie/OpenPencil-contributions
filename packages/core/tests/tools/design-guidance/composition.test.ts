import { expect, test } from 'bun:test'

import dedent from 'dedent'
import * as v from 'valibot'

import { instanceMainComponent } from '@open-pencil/scene-graph'

import { createEditor } from '#core/editor/create'
import { FigmaAPI } from '#core/figma-api'
import { ALL_TOOLS } from '#core/tools/registry'

test('nested component edits reach screen consumers while preserving their content overrides', async () => {
  const editor = createEditor()
  const graph = editor.graph
  const figma = new FigmaAPI(graph)
  async function call(name: string, args: Record<string, unknown>) {
    const tool = ALL_TOOLS.find((candidate) => candidate.name === name)
    if (!tool) throw new Error(`Missing tool: ${name}`)
    return editor.runMutationWithLayout(() => tool.execute(figma, args))
  }
  async function render(jsx: string) {
    return v.parse(v.object({ id: v.string() }), await call('render', { jsx })).id
  }
  try {
    const collection = v.parse(
      v.object({ id: v.string(), defaultModeId: v.string() }),
      await call('create_collection', { name: 'Service foundations' })
    )
    const space = v.parse(
      v.object({ id: v.string() }),
      await call('create_variable', {
        collection_id: collection.id,
        name: 'Space/control',
        type: 'FLOAT',
        value: '12'
      })
    )
    const button =
      await render(dedent`<Component name="Button" flex="row" w="hug" h="hug" p={designVar('${space.id}')} rounded={8}>
      <Text name="Label" w={80} h={20}>Book service</Text>
    </Component>`)
    const card =
      await render(dedent`<Component name="Service card" flex="col" w={280} h="hug" gap={designVar('${space.id}')}>
      <Text name="Title" w={240} h={24}>Service</Text>
      <Instance of="${button}" name="Booking action" />
    </Component>`)
    const title = graph.getChildren(card).find((node) => node.name === 'Title')
    if (!title) throw new Error('Missing card title')
    const property = v.parse(
      v.object({ property: v.object({ id: v.string() }) }),
      await call('create_component_property', {
        owner_id: card,
        name: 'Service name',
        type: 'TEXT',
        default_value: 'Service'
      })
    ).property.id
    await call('bind_component_property', {
      id: title.id,
      field: 'TEXT',
      property_id: property
    })
    const screen = await render(dedent`<Frame name="Services" flex="col" w={320} h="hug">
      <Instance of="${card}" name="Tune-up" />
      <Instance of="${card}" name="Wheel repair" />
    </Frame>`)
    const consumers = graph.getChildren(screen)
    expect(consumers).toHaveLength(2)
    const labels = ['Tune-up', 'Wheel repair']
    for (const [index, consumer] of consumers.entries()) {
      await call('set_instance_properties', {
        id: consumer.id,
        values: { [property]: labels[index] }
      })
    }

    await call('set_radius', { id: button, radius: 16 })
    await call('set_variable', { id: space.id, mode: collection.defaultModeId, value: '20' })

    for (const [index, consumer] of consumers.entries()) {
      expect(instanceMainComponent(graph, consumer)?.id).toBe(card)
      const children = graph.getChildren(consumer.id)
      expect(children.find((node) => node.name === 'Title')?.text).toBe(labels[index])
      const action = children.find((node) => node.name === 'Booking action')
      if (!action) throw new Error('Missing nested button')
      expect(action.type).toBe('INSTANCE')
      expect(instanceMainComponent(graph, action)?.id).toBe(button)
      expect(action.cornerRadius).toBe(16)
      expect(action.boundVariables.paddingLeft).toBe(space.id)
      expect(action.paddingLeft).toBe(20)
      expect(await call('get_component_properties', { id: consumer.id })).toMatchObject({
        properties: [
          expect.objectContaining({ id: property, value: labels[index], overridden: true })
        ]
      })
    }
    expect(graph.getNode(title.id)?.text).toBe('Service')
    expect([...graph.nodes.values()].filter((node) => node.type === 'COMPONENT')).toHaveLength(2)
  } finally {
    editor.dispose()
  }
})
