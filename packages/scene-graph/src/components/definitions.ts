import type { SceneGraph } from '../index'
import { instanceMainComponent } from '../instances/main-component'
import { readPluginData } from '../plugin-data/field'
import { OPEN_PENCIL_PLUGIN_DATA } from '../plugin-data/fields'
import type { ComponentPropertyDefinition, SceneNode } from '../types'

export function componentPropertyOwners(graph: SceneGraph, instance: SceneNode): SceneNode[] {
  if (instance.type !== 'INSTANCE') return []
  const component = instanceMainComponent(graph, instance)
  if (!component) return []
  const parent = component.parentId ? graph.getNode(component.parentId) : null
  return parent?.type === 'COMPONENT_SET' ? [parent, component] : [component]
}

export function componentPropertyDefinitions(
  graph: SceneGraph,
  instance: SceneNode
): ComponentPropertyDefinition[] {
  const definitions = new Map<string, ComponentPropertyDefinition>()
  for (const owner of componentPropertyOwners(graph, instance)) {
    for (const definition of owner.componentPropertyDefinitions) {
      if (!definitions.has(definition.id)) definitions.set(definition.id, definition)
    }
  }
  const component = instanceMainComponent(graph, instance)
  const defaults = component
    ? (readPluginData(component.pluginData, OPEN_PENCIL_PLUGIN_DATA.componentVariantDefaults) ?? {})
    : {}
  return [...definitions.values()].map((definition) =>
    Object.hasOwn(defaults, definition.id)
      ? { ...definition, defaultValue: defaults[definition.id], defaultVariableId: undefined }
      : definition
  )
}
