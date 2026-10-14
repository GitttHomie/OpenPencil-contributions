import { expect, test } from 'bun:test'

import dedent from 'dedent'
import * as v from 'valibot'

import { SceneGraph, instanceMainComponent } from '@open-pencil/scene-graph'

import { FigmaAPI } from '#core/figma-api'
import { ALL_TOOLS } from '#core/tools/registry'

test.each(['property binding', 'preferred swaps'])(
  'agents can customize icons through %s while keeping parent instances connected',
  async (route) => {
    const graph = new SceneGraph()
    const figma = new FigmaAPI(graph)
    async function call(name: string, args: Record<string, unknown>) {
      const tool = ALL_TOOLS.find((candidate) => candidate.name === name)
      if (!tool) throw new Error(`Missing tool: ${name}`)
      return tool.execute(figma, args)
    }
    async function render(jsx: string) {
      return v.parse(v.object({ id: v.string() }), await call('render', { jsx })).id
    }
    const icons = await render(dedent`<ComponentSet name="App icons">
      <Component name="Icon=Home" w={24} h={24}>
        <Rectangle name="Home artwork" w={24} h={24} bg="#123456" />
      </Component>
      <Component name="Icon=Search" w={24} h={24}>
        <Ellipse name="Search artwork" w={24} h={24} bg="#654321" />
      </Component>
    </ComponentSet>`)
    const [home, search] = graph.getChildren(icons)
    const button = await render(dedent`<Component name="Button" flex="row" w="hug" h="hug" p={8}>
      <Instance of="${icons}" Icon="Home" name="Icon" />
    </Component>`)
    const icon = graph.getChildren(button)[0]
    // Create consumers before exposing the control, as when an agent extends an existing design.
    const first = await render(`<Instance of="${button}" name="First" />`)
    const second = await render(`<Instance of="${button}" name="Second" />`)

    if (route === 'preferred swaps') {
      await call('expose_instance_swap', {
        instance_ids: [icon.id],
        candidate_ids: [home.id, search.id],
        property_name: 'Icon'
      })
    } else {
      const result = v.parse(
        v.object({ property: v.object({ id: v.string() }) }),
        await call('create_component_property', {
          owner_id: button,
          name: 'Icon',
          type: 'INSTANCE_SWAP',
          default_value: home.id
        })
      )
      await call('bind_component_property', {
        id: icon.id,
        field: 'INSTANCE_SWAP',
        property_id: result.property.id
      })
    }
    const state = v.parse(
      v.object({ properties: v.array(v.object({ id: v.string(), type: v.string() })) }),
      await call('get_component_properties', { id: first })
    )
    const property = state.properties.find((item) => item.type === 'INSTANCE_SWAP')
    if (!property) throw new Error('Missing exposed icon choice')
    await call('set_instance_properties', { id: first, values: { [property.id]: search.id } })

    function expectLinkedChoices() {
      for (const [id, expectedIcon] of [
        [first, search.id],
        [second, home.id]
      ]) {
        const instance = graph.getNode(id)
        expect(instance).toMatchObject({ type: 'INSTANCE', componentId: button })
        const nested = graph.getChildren(id)[0]
        expect(nested.type).toBe('INSTANCE')
        expect(instanceMainComponent(graph, nested)?.id).toBe(expectedIcon)
      }
      expect(instanceMainComponent(graph, icon)?.id).toBe(home.id)
      expect(graph.getChildren(icons).map((node) => node.id)).toEqual([home.id, search.id])
    }
    expectLinkedChoices()

    // Subsequent definition edits must still reach both consumers without resetting icon choices.
    await call('set_radius', { id: button, radius: 12 })
    graph.syncInstances(button)
    expectLinkedChoices()
    expect(graph.getNode(first)?.cornerRadius).toBe(12)
    expect(graph.getNode(second)?.cornerRadius).toBe(12)
    expect(await call('get_component_properties', { id: first })).toMatchObject({
      properties: [expect.objectContaining({ id: property.id, value: search.id, overridden: true })]
    })
  }
)
