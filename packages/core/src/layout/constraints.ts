import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { constrainedChildRect, scaledGeometryChanges } from '@open-pencil/scene-graph/resize'

/** Layout owns flow children; other children retain their anchors when their parent resizes. */
export function updateLayoutNode(
  graph: SceneGraph,
  node: SceneNode,
  changes: Partial<SceneNode>
): void {
  const before = { width: node.width, height: node.height }
  graph.updateNode(node.id, changes)
  if (before.width === node.width && before.height === node.height) return

  const scalesChildren = node.type === 'GROUP' || node.type === 'BOOLEAN_OPERATION'
  for (const child of graph.getChildren(node.id)) {
    if (node.layoutMode !== 'NONE' && child.layoutPositioning !== 'ABSOLUTE') continue
    const rect = constrainedChildRect(
      child,
      before,
      node,
      scalesChildren ? 'SCALE' : child.horizontalConstraint,
      scalesChildren ? 'SCALE' : child.verticalConstraint,
      false
    )
    if (
      rect.x === child.x &&
      rect.y === child.y &&
      rect.width === child.width &&
      rect.height === child.height
    )
      continue
    updateLayoutNode(graph, child, {
      ...rect,
      ...scaledGeometryChanges(child, child.width, child.height, rect.width, rect.height)
    })
  }
}
