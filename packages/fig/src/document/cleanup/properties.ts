import { idOf, parentIdOf, type SourceIndex } from '#fig/instance-overrides/source-index'

import type { GUID, NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'

import { assignedComponent, swapDefinitions } from './references'

function hasParentDefinition(index: SourceIndex, node: NodeChange, propertyId: string): boolean {
  const visited = new Set<string>()
  let parent = parentIdOf(node)
  while (parent && !visited.has(parent)) {
    visited.add(parent)
    const ancestor = index.sources.get(parent)
    if (!ancestor) return false
    if (swapDefinitions(ancestor).some((def) => def.id && guidToString(def.id) === propertyId))
      return true
    parent = parentIdOf(ancestor)
  }
  return false
}

/** A removed set property also removes every variant-local definition inheriting from it. */
export function collectRemovedProperties(
  index: SourceIndex,
  unavailable: (guid: GUID | undefined) => boolean,
  removeTargets: (nodeId: string, propertyId: GUID) => void
): Set<string> {
  const removed = new Set<string>()
  const dependents = new Map<string, Array<{ nodeId: string; propertyId: GUID }>>()
  const pending: string[] = []
  const remove = (nodeId: string, propertyId: GUID) => {
    const id = guidToString(propertyId)
    removeTargets(nodeId, propertyId)
    if (removed.has(id)) return
    removed.add(id)
    pending.push(id)
  }
  for (const node of index.sources.values()) {
    const nodeId = idOf(node)
    if (!nodeId) continue
    for (const def of swapDefinitions(node)) {
      if (!def.id) continue
      if (
        def.type === 'INSTANCE_SWAP' &&
        unavailable(assignedComponent({ value: def.initialValue, varValue: def.varValue }))
      )
        remove(nodeId, def.id)
      if (!def.parentPropDefId) continue
      const parentId = guidToString(def.parentPropDefId)
      const children = dependents.get(parentId) ?? []
      children.push({ nodeId, propertyId: def.id })
      dependents.set(parentId, children)
      // Also repair an archive saved after an older cleanup left this link dangling.
      if (!hasParentDefinition(index, node, parentId)) remove(nodeId, def.id)
    }
  }
  for (const parentId of pending) {
    for (const child of dependents.get(parentId) ?? []) {
      remove(child.nodeId, child.propertyId)
    }
  }
  return removed
}
