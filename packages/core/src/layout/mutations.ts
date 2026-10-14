import {
  collectSceneMutation,
  mutationLayoutScopeIds,
  type SceneGraph,
  type SceneMutationImpact
} from '@open-pencil/scene-graph'

import { computeAllLayouts, computeLayoutForNode } from '#core/layout'

import { trackLayoutEdits } from './invalidation'

export function createLayoutRunner(getGraph: () => SceneGraph) {
  trackLayoutEdits(getGraph())
  function runLayoutForNode(id: string) {
    computeLayoutForNode(getGraph(), id)
  }

  function compactLayoutScope(impact: SceneMutationImpact): string[] {
    const graph = getGraph()
    const candidates = new Set(mutationLayoutScopeIds(impact).filter((id) => graph.getNode(id)))
    return [...candidates].filter((id) => {
      let parentId = graph.getNode(id)?.parentId ?? null
      while (parentId) {
        if (candidates.has(parentId)) return false
        parentId = graph.getNode(parentId)?.parentId ?? null
      }
      return true
    })
  }

  async function runMutationWithLayout<T>(
    operation: () => T | Promise<T>,
    fallbackId?: string,
    beforeLayout?: (result: T) => Promise<void> | void
  ): Promise<T> {
    const graph = getGraph()
    const { result, impact } = await collectSceneMutation(graph, operation)
    await beforeLayout?.(result)
    if (!runLayoutForImpact(impact) && fallbackId) computeAllLayouts(graph, fallbackId)
    return result
  }

  /** Lays out what an edit touched; returns whether there was anything to lay out. */
  function runLayoutForImpact(impact: SceneMutationImpact): boolean {
    const scopeIds = compactLayoutScope(impact)
    for (const id of scopeIds) runLayoutForNode(id)
    return scopeIds.length > 0
  }

  return { runLayoutForNode, runLayoutForImpact, runMutationWithLayout }
}
