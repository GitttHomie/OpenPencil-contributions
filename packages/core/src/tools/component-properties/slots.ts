import * as v from 'valibot'

import {
  createSlotProperty,
  componentPropertyDefinitions,
  resetSlotContent,
  slotLimitViolations,
  slotOwner,
  slotScope,
  updateSlotProperty,
  type SlotPropertyPatch
} from '@open-pencil/scene-graph'

import { assertNodeEditable } from '#core/editor/capabilities'
import { mergeSlotSettings } from '#core/figma-api/slots'
import { randomHex } from '#core/random'
import { nodeIdInput, toolNumber } from '#core/tools/input'
import { defineTool } from '#core/tools/schema'

import {
  propertyDefinition,
  propertyOwner,
  syncPropertyOwner,
  validatePropertyName
} from './helpers'

export const createComponentSlot = defineTool({
  name: 'create_component_slot',
  description:
    'Turn an existing frame inside a main component into a content slot, preserving its layout and children as defaults. Instances can customize children inside this slot. Returns the slot property ID for configuration.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.object({ id: nodeIdInput }),
  execute(figma, { id }) {
    const node = figma.graph.getNode(id)
    const owner = node && slotOwner(figma.graph, node)
    if (!owner) throw new Error('Select a frame inside a main component')
    assertNodeEditable(figma.graph, id)
    assertNodeEditable(figma.graph, owner.id)
    const definition = createSlotProperty(figma.graph, id, `prop:${randomHex(8)}`)
    if (!definition) throw new Error('The node must be a frame that is not already a slot')
    syncPropertyOwner(figma, owner.id)
    return { id, owner_id: owner.id, property: structuredClone(definition) }
  }
})

const count = v.nullable(toolNumber(v.pipe(v.number(), v.integer(), v.minValue(0))))

export const configureComponentSlot = defineTool({
  name: 'configure_component_slot',
  description:
    'Set a slot name, description, preferred component IDs and child limits/behavior. Null clears a child limit; omitted fields keep their values. Preferred-only and min/max settings are constraints reported by the editor, not automatic deletion of content.',
  execution: { kind: 'sync', mutation: 'properties' },
  input: v.object({
    owner_id: nodeIdInput,
    property_id: v.string(),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    preferred_components: v.optional(v.array(nodeIdInput)),
    min_children: v.optional(count),
    max_children: v.optional(count),
    preferred_only: v.optional(v.boolean()),
    display_empty: v.optional(v.boolean()),
    stretch_child: v.optional(v.boolean())
  }),
  execute(figma, args) {
    propertyOwner(figma, args.owner_id)
    const definition = propertyDefinition(figma, args.owner_id, args.property_id)
    if (definition.type !== 'SLOT') throw new Error('property_id must identify a slot')
    if (args.name !== undefined)
      validatePropertyName(figma, args.owner_id, args.name, definition.id)
    for (const id of args.preferred_components ?? []) {
      const type = figma.graph.getNode(id)?.type
      if (type !== 'COMPONENT' && type !== 'COMPONENT_SET')
        throw new Error(`Preferred value "${id}" must identify a component or component set`)
    }
    const settings = mergeSlotSettings(definition.slotSettings, {
      minChildren: args.min_children,
      maxChildren: args.max_children,
      allowPreferredValuesOnly: args.preferred_only,
      displayEmptyByDefault: args.display_empty,
      stretchChildOnInsert: args.stretch_child
    })
    if (
      settings.minChildren !== undefined &&
      settings.maxChildren !== undefined &&
      settings.minChildren > settings.maxChildren
    )
      throw new Error('min_children cannot exceed max_children')
    const patch: SlotPropertyPatch = { slotSettings: settings }
    if (args.name !== undefined) patch.name = args.name.trim()
    if (args.description !== undefined) patch.description = args.description
    if (args.preferred_components !== undefined) patch.preferredValues = args.preferred_components
    // Explicit undefined clears a previous limit when the shared authoring helper merges settings.
    patch.slotSettings = {
      ...settings,
      minChildren: settings.minChildren,
      maxChildren: settings.maxChildren
    }
    updateSlotProperty(figma.graph, args.owner_id, args.property_id, patch)
    return {
      owner_id: args.owner_id,
      property: structuredClone(propertyDefinition(figma, args.owner_id, args.property_id))
    }
  }
})

export const resetInstanceSlot = defineTool({
  name: 'reset_instance_slot',
  description:
    'Discard one instance slot’s customized children and restore its main component’s default content. The ID must be the slot frame inside the instance, not the main component’s frame.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.object({ id: nodeIdInput }),
  execute(figma, { id }) {
    const scope = slotScope(figma.graph, id)
    if (scope.kind !== 'slot' || scope.frame.id !== id)
      throw new Error('id must identify a slot frame inside an instance')
    const node = figma.getNodeById(id)
    if (!node) throw new Error('Slot not found')
    assertNodeEditable(figma.graph, id)
    resetSlotContent(figma.graph, scope)
    const definition = componentPropertyDefinitions(figma.graph, scope.instance).find(
      (item) => item.id === scope.propertyId
    )
    return {
      id,
      children: figma.graph.getChildren(id).map((child) => ({ id: child.id, name: child.name })),
      violations: definition
        ? slotLimitViolations(figma.graph, definition, figma.graph.getChildren(id))
        : []
    }
  }
})
