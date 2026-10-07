import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

/** Project a visible leaf onto the immediate child of the active selection scope. */
export function selectionAtScope(
  graph: SceneGraph,
  hit: SceneNode | null,
  scopeId: string
): SceneNode | null {
  let node = hit
  while (node && node.id !== scopeId) {
    if (node.parentId === scopeId) return node
    node = node.parentId ? (graph.getNode(node.parentId) ?? null) : null
  }
  return null
}
