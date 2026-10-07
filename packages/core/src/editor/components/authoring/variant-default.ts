import {
  OPEN_PENCIL_PLUGIN_DATA,
  readPluginData,
  withPluginData,
  resolveComponentPropertyValue,
  type SceneGraph
} from '@open-pencil/scene-graph'

import { assertNodeEditable } from '#core/editor/capabilities'

import { componentAuthoringContext, componentPropertySources } from './context'
import { acceptsComponentPropertyValue } from './values'

export function variantDefaultForSource(
  graph: SceneGraph,
  nodeId: string,
  propertyId: string
): string | undefined {
  const component = componentAuthoringContext(graph, nodeId)?.component
  return component
    ? readPluginData(component.pluginData, OPEN_PENCIL_PLUGIN_DATA.componentVariantDefaults)?.[
        propertyId
      ]
    : undefined
}

/** Validate once for editor controls and tools; callers own mutation and undo. */
export function prepareVariantDefault(
  graph: SceneGraph,
  variantId: string,
  propertyId: string,
  value: string | null
) {
  const variant = graph.getNode(variantId)
  const set = variant?.parentId ? graph.getNode(variant.parentId) : undefined
  if (variant?.type !== 'COMPONENT' || set?.type !== 'COMPONENT_SET') return null
  const definition = set.componentPropertyDefinitions.find((item) => item.id === propertyId)
  if (!definition || !['TEXT', 'BOOLEAN', 'INSTANCE_SWAP'].includes(definition.type)) return null
  const nextValue = value ?? definition.defaultValue
  if (definition.type === 'BOOLEAN' && !['true', 'false'].includes(nextValue)) return null
  if (definition.type === 'INSTANCE_SWAP' && !resolveComponentPropertyValue(graph, nextValue))
    return null
  assertNodeEditable(graph, set.id)
  assertNodeEditable(graph, variantId)
  const targets = componentPropertySources(graph, variantId, propertyId)
  if (
    targets.some(({ node, field }) => !acceptsComponentPropertyValue(graph, node, field, nextValue))
  )
    return null
  for (const { node } of targets) assertNodeEditable(graph, node.id)
  const defaults = Object.fromEntries(
    Object.entries(
      readPluginData(variant.pluginData, OPEN_PENCIL_PLUGIN_DATA.componentVariantDefaults) ?? {}
    ).filter(([id]) => id !== propertyId)
  )
  if (value !== null) defaults[propertyId] = value
  return {
    variant,
    targets,
    value: nextValue,
    pluginData: withPluginData(
      variant.pluginData,
      OPEN_PENCIL_PLUGIN_DATA.componentVariantDefaults,
      Object.keys(defaults).length ? defaults : undefined
    )
  }
}
