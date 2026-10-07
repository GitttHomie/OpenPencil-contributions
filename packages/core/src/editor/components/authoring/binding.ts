import { componentPropertyDefinitions } from '@open-pencil/scene-graph'
import type { ComponentPropertyReferenceField, SceneGraph } from '@open-pencil/scene-graph'

export interface ComponentPropertyEditTarget {
  nodeId: string
  propertyId: string
  propertyName: string
  kind: 'default' | 'override'
}

/** Locate the definition or instance assignment that controls a layer's field. */
export function componentPropertyEditTarget(
  graph: SceneGraph,
  nodeId: string,
  field: ComponentPropertyReferenceField
): ComponentPropertyEditTarget | null {
  const node = graph.getNode(nodeId)
  const reference = node?.componentPropertyReferences.find((item) => item.field === field)
  if (!node || !reference) return null
  let parent = node.parentId ? graph.getNode(node.parentId) : undefined
  while (parent) {
    const definitions =
      parent.type === 'INSTANCE'
        ? componentPropertyDefinitions(graph, parent)
        : parent.componentPropertyDefinitions
    const definition = definitions.find((item) => item.id === reference.propertyId)
    if (definition) {
      return {
        nodeId: parent.id,
        propertyId: definition.id,
        propertyName: definition.name,
        kind: parent.type === 'INSTANCE' ? 'override' : 'default'
      }
    }
    parent = parent.parentId ? graph.getNode(parent.parentId) : undefined
  }
  return null
}
