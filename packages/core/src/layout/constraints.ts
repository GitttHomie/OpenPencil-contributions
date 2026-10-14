import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

/** Intrinsic growth preserves a free layer's MAX/CENTER anchor, including overhang. */
export function hugFrameSizeChanges(
  graph: SceneGraph,
  frame: SceneNode,
  changes: Partial<SceneNode>
): Partial<SceneNode> {
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
  return updates
}
