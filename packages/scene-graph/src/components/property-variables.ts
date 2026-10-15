import type { SceneGraph } from '../index'
import { hasVisibilityVariableOverride } from '../instance-overrides'
import { instancePropertySource } from '../instances/main-component'
import { readPluginData } from '../plugin-data/field'
import { OPEN_PENCIL_PLUGIN_DATA } from '../plugin-data/fields'
import type { ComponentPropertyDefinition, SceneNode } from '../types'
import { componentPropertyDefinitions } from './definitions'

/** A literal assignment stops inheritance, even when its value equals the default. */
export function componentPropertyValueSource(
  graph: SceneGraph,
  owner: SceneNode,
  definition: ComponentPropertyDefinition
): { value: string; variableId?: string } {
  const assigned =
    owner.type === 'INSTANCE' ? instancePropertySource(graph, owner, definition.id) : undefined
  if (assigned)
    return { value: assigned.value ?? definition.defaultValue, variableId: assigned.variableId }
  const variantDefault =
    owner.type === 'COMPONENT'
      ? readPluginData(owner.pluginData, OPEN_PENCIL_PLUGIN_DATA.componentVariantDefaults)?.[
          definition.id
        ]
      : undefined
  return variantDefault === undefined
    ? { value: definition.defaultValue, variableId: definition.defaultVariableId }
    : { value: variantDefault }
}

export function resolvedComponentPropertyValue(
  graph: SceneGraph,
  owner: SceneNode,
  definition: ComponentPropertyDefinition,
  targetId = owner.id
): string {
  const source = componentPropertyValueSource(graph, owner, definition)
  const resolved = source.variableId && graph.resolveVariableForNode(targetId, source.variableId)
  return typeof resolved === 'boolean' ? String(resolved) : source.value
}

/** Find the property that owns this layer's visibility, including a set's shared definition. */
export function visibilityPropertySource(graph: SceneGraph, node: SceneNode) {
  const reference = node.componentPropertyReferences.find((item) => item.field === 'VISIBLE')
  if (!reference) return undefined
  let result: { value: string; variableId?: string } | undefined
  graph.closest(node.id, (owner) => {
    const parent =
      owner.type === 'COMPONENT' && owner.parentId ? graph.getNode(owner.parentId) : undefined
    const definitions =
      owner.type === 'INSTANCE'
        ? componentPropertyDefinitions(graph, owner)
        : [
            ...owner.componentPropertyDefinitions,
            ...(parent?.type === 'COMPONENT_SET' ? parent.componentPropertyDefinitions : [])
          ]
    const definition = definitions.find(
      (item) => item.id === reference.propertyId && item.type === 'BOOLEAN'
    )
    if (!definition) return false
    result = componentPropertyValueSource(graph, owner, definition)
    return true
  })
  return result
}

/** Direct layer-variable overrides win over an exposed property's inherited default. */
export function visibilityVariableId(graph: SceneGraph, node: SceneNode): string | undefined {
  if (hasVisibilityVariableOverride(graph, node)) return node.boundVariables.visible
  const property = visibilityPropertySource(graph, node)
  return property ? property.variableId : node.boundVariables.visible
}
