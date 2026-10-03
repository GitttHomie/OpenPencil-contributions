import type { SceneGraph, SceneNode } from '../'
import {
  getInstanceOverride,
  hasInstanceOverride,
  type InstanceOverrideState
} from '../instance-overrides'

export function mappedComponentChild(
  node: SceneNode,
  ownerId: string,
  overrides: InstanceOverrideState
): string | null {
  const source = getInstanceOverride(overrides, ownerId, node.id, 'sourceComponentId')
  return typeof source === 'string' ? source : node.componentId
}

/**
 * Match across the whole occurrence before discarding obsolete wrappers. Reparenting
 * a definition child must move its existing occurrence, including local overrides.
 */
export function createInstanceStructureSync(
  graph: SceneGraph,
  componentId: string,
  instanceId: string,
  overrides: InstanceOverrideState
) {
  const sourceIds = new Set<string>()
  const collectSource = (id: string) => {
    sourceIds.add(id)
    for (const child of graph.getChildren(id)) collectSource(child.id)
  }
  collectSource(componentId)

  const candidates = new Map<string, SceneNode[]>()
  const managed: SceneNode[] = []
  const claimed = new Set<string>()
  const collectOccurrence = (parentId: string) => {
    for (const child of graph.getChildren(parentId)) {
      const sourceId = mappedComponentChild(child, instanceId, overrides)
      if (sourceId) {
        const source = graph.getNode(sourceId)
        // An imported extra instance may point directly to an unrelated component.
        // Its presence alone does not establish a mapping to this definition.
        if (
          !source ||
          sourceIds.has(sourceId) ||
          child.type !== 'INSTANCE' ||
          source.type !== 'COMPONENT'
        )
          managed.push(child)
        const siblings = candidates.get(sourceId) ?? []
        siblings.push(child)
        candidates.set(sourceId, siblings)
      }
      if (!hasInstanceOverride(overrides, instanceId, child.id, 'componentId'))
        collectOccurrence(child.id)
    }
  }
  collectOccurrence(instanceId)
  const hasLocalOverrides = (node: SceneNode) =>
    [
      ...(overrides.descendants.get(node.id)?.keys() ?? []),
      ...node.instanceOverrides.self.keys()
    ].some((field) => field !== 'sourceComponentId')
  const prefer = (candidate: SceneNode, current: SceneNode) =>
    hasLocalOverrides(candidate) && !hasLocalOverrides(current)
  for (const siblings of candidates.values())
    siblings.sort((a, b) => Number(hasLocalOverrides(b)) - Number(hasLocalOverrides(a)))

  return {
    prefer,
    claim(id: string) {
      claimed.add(id)
    },
    canMatchFallback(node: SceneNode) {
      const sourceId = mappedComponentChild(node, instanceId, overrides)
      return !claimed.has(node.id) && (!sourceId || !sourceIds.has(sourceId))
    },
    reuse(sourceId: string, parentId: string) {
      const node = candidates.get(sourceId)?.find((candidate) => !claimed.has(candidate.id))
      if (!node) return undefined
      claimed.add(node.id)
      graph.reparentNode(node.id, parentId)
      return node
    },
    finish() {
      // Children may have moved out of an obsolete wrapper during reconciliation.
      for (const node of managed.toReversed()) {
        if (!claimed.has(node.id)) graph.deleteNode(node.id)
      }
    }
  }
}

export type InstanceStructureSync = ReturnType<typeof createInstanceStructureSync>
