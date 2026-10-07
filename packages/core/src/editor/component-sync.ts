import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { computeAllLayouts } from '#core/layout'
import { invalidateDerivedLayouts } from '#core/layout/derived'

const isComponent = (node: SceneNode) => node.type === 'COMPONENT'

function componentSyncOrder(graph: SceneGraph, seeds: Set<string>): string[] {
  const dependents = new Map<string, Set<string>>()
  const discover = (id: string): void => {
    if (dependents.has(id)) return
    const parents = new Set<string>()
    dependents.set(id, parents)
    for (const instance of graph.getInstances(id)) {
      const parent = instance.parentId ? graph.closest(instance.parentId, isComponent) : undefined
      if (parent) parents.add(parent.id)
    }
    for (const parent of parents) discover(parent)
  }
  for (const id of seeds) discover(id)
  const result: string[] = []
  const active = new Set<string>()
  const visited = new Set<string>()
  const visit = (id: string): void => {
    if (active.has(id)) throw new Error('Cyclic component synchronization dependency')
    if (visited.has(id)) return
    active.add(id)
    for (const parent of dependents.get(id) ?? []) visit(parent)
    active.delete(id)
    visited.add(id)
    result.push(id)
  }
  for (const id of seeds) visit(id)
  return result.reverse()
}

type ComputeLayouts = (graph: SceneGraph, scopeId?: string) => void
export type ComponentSyncChange = 'structure' | 'creation'

/** Pages are `CANVAS` nodes; layout recomputation is scoped to them. */
function pageIdOf(graph: SceneGraph, nodeId: string): string | null {
  return graph.closest(nodeId, (node) => node.type === 'CANVAS')?.id ?? null
}

/**
 * Only the pages that actually changed need layout work: the edited subtrees, the components
 * they belong to, and every instance of those components, which may sit on another page.
 */
function affectedPageIds(
  graph: SceneGraph,
  editedIds: Iterable<string>,
  componentIds: Iterable<string>
): Set<string> {
  const pageIds = new Set<string>()
  const addPageOf = (nodeId: string) => {
    const pageId = pageIdOf(graph, nodeId)
    if (pageId) pageIds.add(pageId)
  }

  for (const id of editedIds) addPageOf(id)
  for (const componentId of componentIds) {
    addPageOf(componentId)
    for (const instance of graph.getInstances(componentId)) addPageOf(instance.id)
  }
  return pageIds
}

export function createComponentSyncScheduler(
  getGraph: () => SceneGraph,
  requestRender: () => void,
  computeLayouts: ComputeLayouts = computeAllLayouts
) {
  let pendingComponentSync: Set<string> | null = null
  let pendingStructureChanges = new Set<string>()
  let pendingCreatedNodes = new Set<string>()
  let isFlushingComponentSync = false

  function flushComponentSync() {
    const ids = pendingComponentSync
    if (!ids) return
    pendingComponentSync = null
    const structureChanges = pendingStructureChanges
    pendingStructureChanges = new Set()
    const createdNodes = pendingCreatedNodes
    pendingCreatedNodes = new Set()
    isFlushingComponentSync = true
    try {
      const graph = getGraph()
      // New standalone trees retain imported geometry; an existing layout containing
      // newly pasted children still needs to discard its saved dimensions.
      const invalidatedLayouts = invalidateDerivedLayouts(graph, structureChanges, createdNodes)
      const componentIds = new Set<string>()
      for (const id of ids) {
        const component = graph.closest(id, isComponent)
        if (component) componentIds.add(component.id)
      }
      const orderedComponents = componentSyncOrder(graph, componentIds)
      for (const compId of orderedComponents) {
        graph.syncInstances(compId)
      }
      if (invalidatedLayouts.size > 0) {
        invalidateDerivedLayouts(
          graph,
          orderedComponents.flatMap((id) => graph.getInstances(id).map((instance) => instance.id))
        )
      }
      if (componentIds.size > 0 || invalidatedLayouts.size > 0) {
        const pageIds = affectedPageIds(graph, ids, orderedComponents)
        if (pageIds.size === 0) computeLayouts(graph)
        else for (const pageId of pageIds) computeLayouts(graph, pageId)
        requestRender()
      }
    } finally {
      isFlushingComponentSync = false
    }
  }

  function scheduleComponentSync(nodeId: string, change?: ComponentSyncChange) {
    // Import/materialization has already resolved component overrides. These updates
    // are not authored component edits and must not reset instances to their defaults.
    if (isFlushingComponentSync || getGraph().isApplyingImportedState) return
    if (!pendingComponentSync) {
      pendingComponentSync = new Set()
      queueMicrotask(flushComponentSync)
    }
    pendingComponentSync.add(nodeId)
    if (change) pendingStructureChanges.add(nodeId)
    if (change === 'creation') pendingCreatedNodes.add(nodeId)
  }

  return { scheduleComponentSync }
}
