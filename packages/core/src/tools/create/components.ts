import * as v from 'valibot'

import type { FigmaComponentNode, FigmaNodeProxy } from '#core/figma-api/index'
import { withBatch } from '#core/tools/batch/define'
import {
  instancePropertyValuesInput,
  setInstancePropertyValues
} from '#core/tools/component-properties'
import { toolNumber } from '#core/tools/input'
import { setLayoutChild } from '#core/tools/modify/layout'
import { defineTool, nodeSummary, requireNodes } from '#core/tools/schema'

export const createComponent = defineTool({
  name: 'create_component',

  description: 'Convert a frame/group into a component.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.strictObject({
    id: v.pipe(v.string(), v.description('Node ID to convert'))
  }),
  execute: (figma, { id }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    const component = figma.createComponentFromNode(node)
    return nodeSummary(component)
  }
})

export const createInstance = withBatch(
  defineTool({
    name: 'create_instance',

    description:
      'Create connected component instances with initial exposed-property values and an optional destination parent. ' +
      'Preserve component sizing by default; use FILL to participate in the parent auto-layout, not guessed dimensions. ' +
      'Use a variant component ID to instantiate that variant.',
    execution: { kind: 'sync', mutation: 'document' },
    input: v.strictObject({
      component_id: v.pipe(v.string(), v.description('Component node ID')),
      parent_id: v.optional(v.pipe(v.string(), v.description('Destination container ID'))),
      values: v.optional(instancePropertyValuesInput),
      sizing_horizontal: setLayoutChild.input.entries.sizing_horizontal,
      sizing_vertical: setLayoutChild.input.entries.sizing_vertical,
      x: v.optional(toolNumber(v.pipe(v.number(), v.description('X position')))),
      y: v.optional(toolNumber(v.pipe(v.number(), v.description('Y position'))))
    }),
    execute: (figma, args) => {
      const component = figma.getNodeById(args.component_id)
      if (component?.type !== 'COMPONENT')
        throw new Error(`"${args.component_id}" must identify a component`)
      const parent =
        args.parent_id === undefined ? figma.currentPage : figma.getNodeById(args.parent_id)
      if (
        !parent ||
        !['CANVAS', 'FRAME', 'GROUP', 'SECTION', 'COMPONENT', 'SLOT'].includes(parent.type)
      )
        throw new Error('parent_id must identify a container that accepts instances')
      const instance = component.createInstance()
      if (instance.parent?.id !== parent.id) parent.appendChild(instance)
      if (args.values) setInstancePropertyValues(figma, instance.id, args.values)
      setLayoutChild.execute(figma, {
        id: instance.id,
        sizing_horizontal: args.sizing_horizontal,
        sizing_vertical: args.sizing_vertical
      })
      if (args.x !== undefined) instance.x = args.x
      if (args.y !== undefined) instance.y = args.y
      return nodeSummary(instance)
    }
  }),
  { rollbackSingle: true }
)

export const combineAsVariants = defineTool({
  name: 'combine_as_variants',

  description:
    'Combine components sharing a parent into a component set (variant set). Components named ' +
    'as Figma names variants, "State=On, Size=Large", get those variant properties; names like ' +
    '"Button/Primary" derive a Variant property from the segments after the first slash.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.strictObject({
    ids: v.pipe(v.array(v.string()), v.minLength(1), v.description('Component node IDs to combine'))
  }),
  execute: (figma, { ids }) => {
    const nodes = requireNodes(figma, ids)
    if (!nodes) return { error: 'One or more node IDs were not found' }
    if (nodes.length < 2) return { error: 'Need at least 2 components to combine as variants' }
    if (!nodes.every((node): node is FigmaComponentNode => node.type === 'COMPONENT')) {
      return { error: 'combineAsVariants requires COMPONENT nodes' }
    }
    const parent = nodes[0].parent ?? figma.currentPage
    if (!nodes.every((node) => node.parent?.id === parent.id)) {
      return { error: 'combineAsVariants requires components to share a parent' }
    }
    try {
      const componentSet = figma.combineAsVariants(nodes, parent)
      return nodeSummary(componentSet)
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) }
    }
  }
})

export const exposeInstanceSwap = defineTool({
  name: 'expose_instance_swap',

  description:
    'Expose nested instances through an instance-swap property with preferred component choices. ' +
    'Use this to customize icons without detaching their parent instances. Read the property ID ' +
    'with get_component_properties, then override it with set_instance_properties. This is a ' +
    'component-choice property, not an editable content slot.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.strictObject({
    instance_ids: v.pipe(v.array(v.string()), v.minLength(1), v.description('Instance node IDs')),
    candidate_ids: v.pipe(
      v.array(v.string()),
      v.minLength(1),
      v.description('Candidate component node IDs')
    ),
    property_name: v.optional(v.pipe(v.string(), v.description('Property name')))
  }),
  execute: (figma, { instance_ids, candidate_ids, property_name }) => {
    const slots = instance_ids
      .map((id) => figma.getNodeById(id))
      .filter((node): node is FigmaNodeProxy => node !== null)
    if (slots.length !== instance_ids.length)
      return { error: 'One or more instance IDs were not found' }
    const candidates = candidate_ids
      .map((id) => figma.getNodeById(id))
      .filter((node): node is FigmaNodeProxy => node !== null)
    if (candidates.length !== candidate_ids.length)
      return { error: 'One or more candidate IDs were not found' }
    try {
      return nodeSummary(figma.exposeInstanceSwap(slots, candidates, property_name))
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) }
    }
  }
})
