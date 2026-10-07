import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

/** Explicit sizing/layout edits supersede geometry materialized when a file was read. */
export function hasEditedLayout(node: SceneNode): boolean {
  return node.source.editedFields.some((key) =>
    [
      'layoutMode',
      'primaryAxisSizing',
      'counterAxisSizing',
      'layoutGrow',
      'layoutAlignSelf',
      'derivedLayout'
    ].includes(key)
  )
}

/** A content edit invalidates saved geometry throughout the connected layout tree. */
export function invalidateDerivedLayout(graph: SceneGraph, nodeId: string): void {
  invalidateDerivedLayouts(graph, [nodeId])
}

/** Batch connected trees so several edits in the same layout invalidate it only once. */
export function invalidateDerivedLayouts(
  graph: SceneGraph,
  nodeIds: Iterable<string>,
  preservedRoots?: ReadonlySet<string>
): Set<string> {
  const roots = new Set<SceneNode>()
  for (const nodeId of nodeIds) {
    const root = graph.closest(nodeId, (node) => {
      const parent = node.parentId ? graph.getNode(node.parentId) : undefined
      return node.layoutPositioning === 'ABSOLUTE' || !parent || parent.layoutMode === 'NONE'
    })
    if (root && !preservedRoots?.has(root.id)) roots.add(root)
  }
  const changedRoots = new Set<string>()
  const visited = new Set<string>()
  function invalidate(node: SceneNode, rootId: string) {
    if (visited.has(node.id)) return
    visited.add(node.id)
    if (node.derivedLayout || (node.source.format === 'fig' && !hasEditedLayout(node))) {
      graph.updateNode(node.id, { derivedLayout: null })
      changedRoots.add(rootId)
    }
    if (node.layoutMode === 'NONE') return
    for (const child of graph.getChildren(node.id)) {
      if (child.layoutPositioning !== 'ABSOLUTE') invalidate(child, rootId)
    }
  }
  for (const root of roots) invalidate(root, root.id)
  return changedRoots
}

export function usesDetachedDerivedLayout(child: SceneNode): boolean {
  const derived = child.derivedLayout
  if (!derived || hasEditedLayout(child) || child.layoutMode === 'NONE' || child.layoutGrow > 0)
    return false
  const isRow = child.layoutMode === 'HORIZONTAL'
  const widthSizing = isRow ? child.primaryAxisSizing : child.counterAxisSizing
  const heightSizing = isRow ? child.counterAxisSizing : child.primaryAxisSizing
  return (
    (widthSizing === 'HUG' && derived.width !== undefined) ||
    (heightSizing === 'HUG' && derived.height !== undefined)
  )
}
