import * as v from 'valibot'

import {
  componentPropertyDefinitions,
  componentPropertyOwners,
  findComponentPropertyTargets
} from '@open-pencil/scene-graph'

import { assertNodeEditable } from '#core/editor/capabilities'
import {
  COMPONENT_FIELD_TYPES,
  componentBindingNodes,
  componentAuthoringContext
} from '#core/editor/components/authoring/context'
import {
  prepareVariantDefault,
  variantDefaultForSource
} from '#core/editor/components/authoring/variant-default'
import { applyInstancePropertyValue } from '#core/editor/components/properties'
import { nodeIdInput } from '#core/tools/input'
import { defineTool } from '#core/tools/schema'

import {
  applySource,
  bindingVariantState,
  instancePropertyState,
  propertyDefinition,
  propertyKey,
  propertyOwner,
  propertySources,
  validatePropertyName,
  validatePropertyValue,
  validateSource,
  syncPropertyOwner
} from './helpers'

const propertyIdInput = v.pipe(
  v.string(),
  v.description(
    'Stable property ID returned by get_component_properties or create_component_property'
  )
)
const valueInput = v.union([v.string(), v.boolean()])

export const getComponentProperties = defineTool({
  name: 'get_component_properties',
  description:
    'Inspect component definitions, property types/defaults, connected objects, instance overrides, variants and slot settings. Use returned stable property IDs in authoring tools.',
  execution: { kind: 'sync', mutation: 'none' },
  input: v.object({ id: nodeIdInput }),
  execute(figma, { id }) {
    const node = figma.graph.getNode(id)
    if (!node) throw new Error(`Node "${id}" not found`)
    const context = componentAuthoringContext(figma.graph, id)
    let owners = context?.owners ?? []
    if (node.type === 'INSTANCE') owners = componentPropertyOwners(figma.graph, node)
    else if (node.type === 'COMPONENT_SET') {
      owners = [
        node,
        ...figma.graph.getChildren(node.id).filter((child) => child.type === 'COMPONENT')
      ]
    }
    const definitions =
      node.type === 'INSTANCE'
        ? componentPropertyDefinitions(figma.graph, node)
        : owners.flatMap((owner) => owner.componentPropertyDefinitions)
    return {
      id,
      owner_ids: owners.map((owner) => owner.id),
      properties: definitions.map((definition) => ({
        ...structuredClone(definition),
        bindings: owners
          .filter((owner) =>
            owner.componentPropertyDefinitions.some((item) => item.id === definition.id)
          )
          .flatMap((owner) =>
            componentBindingNodes(figma.graph, owner.id).flatMap((source) =>
              source.componentPropertyReferences
                .filter((reference) => reference.propertyId === definition.id)
                .map((reference) => ({
                  node_id: source.id,
                  name: source.name,
                  field: reference.field,
                  ...bindingVariantState(figma, source.id, definition.id)
                }))
            )
          ),
        ...instancePropertyState(figma, node, definition)
      })),
      references: structuredClone(node.componentPropertyReferences)
    }
  }
})

export const createComponentProperty = defineTool({
  name: 'create_component_property',
  description:
    'Create a reusable String (TEXT), Boolean, or instance-swap property on a main component or component set. Then bind_component_property to one or more child objects. Does not create variables.',
  execution: { kind: 'sync', mutation: 'properties' },
  input: v.object({
    owner_id: nodeIdInput,
    name: v.string(),
    type: v.picklist(['TEXT', 'BOOLEAN', 'INSTANCE_SWAP']),
    default_value: valueInput
  }),
  execute(figma, args) {
    const owner = propertyOwner(figma, args.owner_id)
    validatePropertyName(figma, owner.id, args.name)
    validatePropertyValue(figma, args.type, args.default_value)
    const key = owner.addComponentProperty(args.name.trim(), args.type, args.default_value)
    const definition = figma.graph
      .getNode(owner.id)
      ?.componentPropertyDefinitions.find((item) => propertyKey(item) === key)
    if (!definition) throw new Error('Property creation failed')
    return { owner_id: owner.id, property: structuredClone(definition) }
  }
})

export const editComponentProperty = defineTool({
  name: 'edit_component_property',
  description:
    'Rename a component property or change its shared default, preserving variant defaults and instance overrides. Supply variant_id to change only that variant’s default, or reset_variant_default=true to inherit the shared default again. Use set_instance_properties for an instance override.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.object({
    owner_id: nodeIdInput,
    property_id: propertyIdInput,
    name: v.optional(v.string()),
    default_value: v.optional(valueInput),
    variant_id: v.optional(nodeIdInput),
    reset_variant_default: v.optional(v.boolean())
  }),
  execute(figma, args) {
    const owner = propertyOwner(figma, args.owner_id)
    const definition = propertyDefinition(figma, owner.id, args.property_id)
    if (definition.type === 'VARIANT')
      throw new Error('Use the variant authoring workflow for VARIANT definitions')
    if (args.variant_id) {
      if (args.name !== undefined || figma.graph.getNode(args.variant_id)?.parentId !== owner.id)
        throw new Error('variant_id must belong to owner_id; rename shared properties separately')
      if (args.default_value === undefined && !args.reset_variant_default)
        throw new Error('Provide default_value or reset_variant_default')
      if (args.default_value !== undefined)
        validatePropertyValue(figma, definition.type, args.default_value)
      const edit = prepareVariantDefault(
        figma.graph,
        args.variant_id,
        definition.id,
        args.reset_variant_default ? null : String(args.default_value)
      )
      if (!edit) throw new Error('Invalid variant property default')
      figma.graph.updateNode(edit.variant.id, { pluginData: edit.pluginData })
      for (const { node, field } of edit.targets) applySource(figma, node, field, edit.value)
      syncPropertyOwner(figma, edit.variant.id)
      return {
        owner_id: owner.id,
        variant_id: edit.variant.id,
        default_value: edit.value,
        inherited: args.reset_variant_default === true
      }
    }
    if (args.reset_variant_default) throw new Error('reset_variant_default requires variant_id')
    const sources = propertySources(figma, owner.id, definition.id)
    if (args.name !== undefined) validatePropertyName(figma, owner.id, args.name, definition.id)
    if (args.default_value !== undefined) {
      validatePropertyValue(figma, definition.type, args.default_value)
      for (const { node, field } of sources)
        validateSource(figma, node, field, String(args.default_value))
    }
    owner.editComponentProperty(propertyKey(definition), {
      name: args.name,
      defaultValue: args.default_value
    })
    if (args.default_value !== undefined)
      for (const { node, field } of sources)
        if (variantDefaultForSource(figma.graph, node.id, definition.id) === undefined)
          applySource(figma, node, field, String(args.default_value))
    syncPropertyOwner(figma, owner.id)
    return {
      owner_id: owner.id,
      property: structuredClone(propertyDefinition(figma, owner.id, definition.id))
    }
  }
})

export const bindComponentProperty = defineTool({
  name: 'bind_component_property',
  description:
    'Expose a child object through an existing compatible component property: TEXT, VISIBLE (Boolean), or INSTANCE_SWAP. Reuses definitions across objects; null unbinds only this field and preserves its current value. Cannot bind inside an instance.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.object({
    id: nodeIdInput,
    field: v.picklist(['TEXT', 'VISIBLE', 'INSTANCE_SWAP']),
    property_id: v.nullable(propertyIdInput)
  }),
  execute(figma, { id, field, property_id }) {
    const context = componentAuthoringContext(figma.graph, id)
    if (!context?.fields.includes(field))
      throw new Error('Select a compatible child of a main component')
    assertNodeEditable(figma.graph, id)
    assertNodeEditable(figma.graph, context.owner.id)
    const definition = context.owners
      .flatMap((owner) => owner.componentPropertyDefinitions)
      .find((item) => item.id === property_id)
    const defaultValue = definition
      ? (variantDefaultForSource(figma.graph, id, definition.id) ?? definition.defaultValue)
      : ''
    if (property_id) {
      if (!definition || definition.type !== COMPONENT_FIELD_TYPES[field])
        throw new Error('Property is not a compatible definition in this component')
      validateSource(figma, context.node, field, defaultValue)
    }
    const references = context.node.componentPropertyReferences.filter(
      (reference) => reference.field !== field
    )
    if (property_id) references.push({ propertyId: property_id, field })
    figma.graph.updateNode(id, { componentPropertyReferences: references })
    if (definition) applySource(figma, context.node, field, defaultValue)
    syncPropertyOwner(figma, context.component.id, property_id ?? undefined)
    return { id, field, property_id, references: structuredClone(references) }
  }
})

export const deleteComponentProperty = defineTool({
  name: 'delete_component_property',
  description:
    'Delete a component property definition and its bindings/assignments. Preserves the objects. To disconnect one object instead, use bind_component_property with property_id=null.',
  execution: { kind: 'sync', mutation: 'properties' },
  input: v.object({ owner_id: nodeIdInput, property_id: propertyIdInput }),
  execute(figma, { owner_id, property_id }) {
    const owner = propertyOwner(figma, owner_id)
    const definition = propertyDefinition(figma, owner_id, property_id)
    if (definition.type === 'VARIANT')
      throw new Error('Use the variant authoring workflow for VARIANT definitions')
    owner.deleteComponentProperty(propertyKey(definition))
    return { owner_id, deleted_property_id: property_id }
  }
})

export const setInstanceProperties = defineTool({
  name: 'set_instance_properties',
  description:
    'Set text, Boolean or instance-swap overrides by stable property ID on one instance. Preserves component links; content-driven sizing reflows. Inspect get_component_properties first. Variants and slot contents use their own workflows.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.object({
    id: nodeIdInput,
    values: v.record(v.string(), valueInput)
  }),
  execute(figma, { id, values }) {
    const instance = figma.getNodeById(id)
    if (instance?.type !== 'INSTANCE') throw new Error('id must identify an instance')
    assertNodeEditable(figma.graph, id)
    const raw = figma.graph.getNode(id)
    if (!raw) throw new Error('Instance not found')
    const entries = Object.entries(values).map(([propertyId, value]) => {
      const definition = propertyDefinition(figma, id, propertyId)
      validatePropertyValue(figma, definition.type, value)
      for (const target of findComponentPropertyTargets(figma.graph, raw, propertyId)) {
        if (target.field !== 'SLOT_CONTENT')
          validateSource(figma, target.node, target.field, String(value))
      }
      return { definition, value }
    })
    for (const { definition, value } of entries)
      applyInstancePropertyValue(figma.graph, id, definition, String(value))
    return getComponentProperties.execute(figma, { id })
  }
})
