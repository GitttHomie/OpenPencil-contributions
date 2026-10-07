import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { constrainedChildRect, scaledGeometryChanges } from '@open-pencil/scene-graph/resize'

/** Intrinsic growth preserves an excluded/free child's anchor, including intentional overhang. */
export function updateHugFrameSize(
  graph: SceneGraph,
  frame: SceneNode,
  changes: Partial<SceneNode>
): void {
  const parent = frame.parentId ? graph.getNode(frame.parentId) : undefined
  const anchored =
    parent &&
    parent.type !== 'CANVAS' &&
    (parent.layoutMode === 'NONE' || frame.layoutPositioning === 'ABSOLUTE')
  const updates = { ...changes }
  if (anchored) {
    for (const [size, position, constraint] of [
      ['width', 'x', 'horizontalConstraint'],
      ['height', 'y', 'verticalConstraint']
    ] as const) {
      let factor = 0
      if (frame[constraint] === 'MAX') factor = 1
      else if (frame[constraint] === 'CENTER') factor = 0.5
      const shift = (frame[size] - (changes[size] ?? frame[size])) * factor
      if (shift) updates[position] = frame[position] + shift
    }
  }
  updateLayoutNode(graph, frame, updates)
}

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
