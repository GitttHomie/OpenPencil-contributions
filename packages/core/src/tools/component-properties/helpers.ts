import {
  componentPropertyDefinitions,
  resolveComponentPropertyValue,
  type ComponentPropertyDefinition,
  type SceneNode
} from '@open-pencil/scene-graph'

import { assertNodeEditable } from '#core/editor/capabilities'
import {
  componentPropertySources,
  componentAuthoringContext,
  componentPropertyNameExists,
  type ExposableComponentField
} from '#core/editor/components/authoring/context'
import {
  acceptsComponentPropertyValue,
  componentPropertyTextChanges
} from '#core/editor/components/authoring/values'
import { variantDefaultForSource } from '#core/editor/components/authoring/variant-default'
import { applyInstancePropertyValue } from '#core/editor/components/properties'
import type { FigmaAPI, FigmaComponentNode, FigmaComponentSetNode } from '#core/figma-api/index'

export function propertyOwner(figma: FigmaAPI, id: string) {
  const node = figma.getNodeById(id)
  if (node?.type !== 'COMPONENT' && node?.type !== 'COMPONENT_SET')
    throw new Error('owner_id must identify a main component or component set')
  assertNodeEditable(figma.graph, id)
  return node as FigmaComponentNode | FigmaComponentSetNode
}

export function propertyDefinition(figma: FigmaAPI, id: string, propertyId: string) {
  const node = figma.graph.getNode(id)
  if (!node) throw new Error(`Node "${id}" not found`)
  const definitions =
    node.type === 'INSTANCE'
      ? componentPropertyDefinitions(figma.graph, node)
      : node.componentPropertyDefinitions
  const definition = definitions.find((item) => item.id === propertyId)
  if (!definition)
    throw new Error(`Unknown property ID "${propertyId}"; inspect get_component_properties first`)
  return definition
}

export function propertyKey(definition: ComponentPropertyDefinition) {
  return definition.type === 'VARIANT' ? definition.name : `${definition.name}#${definition.id}`
}

export function validatePropertyName(
  figma: FigmaAPI,
  ownerId: string,
  name: string,
  exceptId?: string
) {
  const owner = figma.graph.getNode(ownerId)
  if (
    !owner ||
    !name.trim() ||
    componentPropertyNameExists(figma.graph, owner, name.trim(), exceptId)
  )
    throw new Error('Property name must be non-empty and unique within the component and its set')
}

export function validatePropertyValue(
  figma: FigmaAPI,
  type: ComponentPropertyDefinition['type'],
  value: string | boolean
) {
  if (type === 'BOOLEAN' && ![true, false, 'true', 'false'].includes(value))
    throw new Error('Boolean values must be true or false')
  if (type === 'TEXT' && typeof value !== 'string')
    throw new Error('String properties require text')
  if (type === 'INSTANCE_SWAP' && !resolveComponentPropertyValue(figma.graph, String(value)))
    throw new Error('Instance swap values must identify an existing component')
  if (!['TEXT', 'BOOLEAN', 'INSTANCE_SWAP'].includes(type))
    throw new Error('Use variant selection or slot tools for this property type')
}

export function propertySources(figma: FigmaAPI, ownerId: string, propertyId: string) {
  return componentPropertySources(figma.graph, ownerId, propertyId)
}

export function bindingVariantState(figma: FigmaAPI, nodeId: string, propertyId: string) {
  const context = componentAuthoringContext(figma.graph, nodeId)
  if (context?.owner.type !== 'COMPONENT_SET' || context.component.type !== 'COMPONENT') return {}
  return {
    variant_id: context.component.id,
    variant_default: variantDefaultForSource(figma.graph, nodeId, propertyId)
  }
}

export function validateSource(
  figma: FigmaAPI,
  node: SceneNode,
  field: ExposableComponentField,
  value: string
) {
  assertNodeEditable(figma.graph, node.id)
  if (!acceptsComponentPropertyValue(figma.graph, node, field, value))
    throw new Error(`Property cannot be applied to "${node.name}" (${field})`)
}

export function applySource(
  figma: FigmaAPI,
  node: SceneNode,
  field: ExposableComponentField,
  value: string
) {
  if (field === 'TEXT') figma.graph.updateNode(node.id, componentPropertyTextChanges(node, value))
  else if (field === 'VISIBLE') figma.graph.updateNode(node.id, { visible: value === 'true' })
  else {
    const target = resolveComponentPropertyValue(figma.graph, value)
    if (target && target.id !== node.componentId)
      figma.graph.swapInstanceComponent(node.id, target.id)
  }
}

export function syncPropertyOwner(figma: FigmaAPI, ownerId: string, bindingId?: string) {
  const owner = figma.graph.getNode(ownerId)
  if (!owner) return
  const components =
    owner.type === 'COMPONENT_SET'
      ? figma.graph.getChildren(ownerId).filter((node) => node.type === 'COMPONENT')
      : [owner]
  for (const component of components) {
    figma.graph.syncInstances(component.id)
    for (const instance of figma.graph.getInstances(component.id)) {
      for (const definition of componentPropertyDefinitions(figma.graph, instance)) {
        if (definition.type === 'VARIANT' || definition.type === 'SLOT') continue
        const assigned = Object.hasOwn(instance.componentPropertyAssignments, definition.id)
        if (assigned || bindingId === definition.id) {
          applyInstancePropertyValue(
            figma.graph,
            instance.id,
            definition,
            instance.componentPropertyAssignments[definition.id] ?? definition.defaultValue,
            !assigned
          )
        }
      }
    }
  }
}

export function instancePropertyState(
  figma: FigmaAPI,
  node: SceneNode,
  definition: ComponentPropertyDefinition
) {
  if (node.type !== 'INSTANCE') return {}
  const value =
    definition.type === 'VARIANT'
      ? (figma.graph.getNode(node.componentId ?? '')?.componentPropertyValues[definition.name] ??
        definition.defaultValue)
      : (node.componentPropertyAssignments[definition.id] ?? definition.defaultValue)
  return { value, overridden: Object.hasOwn(node.componentPropertyAssignments, definition.id) }
}
