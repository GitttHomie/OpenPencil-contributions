import type { SceneGraph } from '../index'
import { getInstanceOverride } from '../instance-overrides'
import type { SceneNode } from '../types'

/** Follow the source occurrence even after a local variant swap replaces componentId. */
export function instancePropertyAssignment(
  graph: SceneGraph,
  instance: SceneNode,
  propertyId: string
): string | undefined {
  const seen = new Set<string>()
  let current: SceneNode | undefined = instance
  while (current?.type === 'INSTANCE' && !seen.has(current.id)) {
    seen.add(current.id)
    if (Object.hasOwn(current.componentPropertyAssignments, propertyId))
      return current.componentPropertyAssignments[propertyId]
    const owner: SceneNode | undefined = current.parentId
      ? graph.closest(current.parentId, (node) => node.type === 'INSTANCE')
      : undefined
    const mapped: unknown = owner
      ? getInstanceOverride(owner.instanceOverrides, owner.id, current.id, 'sourceComponentId')
      : undefined
    const sourceId: string | null = typeof mapped === 'string' ? mapped : current.componentId
    current = sourceId ? graph.getNode(sourceId) : undefined
  }
  return undefined
}

/**
 * The main component an instance shows. An instance nested in another instance points at the
 * instance it was cloned from, so follow those links to the component.
 */
export function instanceMainComponent(
  graph: SceneGraph,
  instance: SceneNode
): SceneNode | undefined {
  const seen = new Set<string>()
  let current = instance.componentId ? graph.getNode(instance.componentId) : undefined
  while (current?.type === 'INSTANCE' && current.componentId && !seen.has(current.id)) {
    seen.add(current.id)
    current = graph.getNode(current.componentId)
  }
  return current?.type === 'COMPONENT' ? current : undefined
}
