import { layoutSizingInParent, type SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

/** Fill can follow an independently sized sibling only across the layout direction. */
export function hasIndependentCrossAxisChild(
  graph: SceneGraph,
  parent: SceneNode,
  axis: 'width' | 'height',
  excludingId?: string
): boolean {
  if (parent.layoutMode !== 'VERTICAL' && parent.layoutMode !== 'HORIZONTAL') return false
  const crossAxis = parent.layoutMode === 'VERTICAL' ? 'width' : 'height'
  if (axis !== crossAxis) return false
  const sizingAxis = axis === 'width' ? 'HORIZONTAL' : 'VERTICAL'
  return graph
    .getChildren(parent.id)
    .some(
      (child) =>
        child.id !== excludingId &&
        child.visible &&
        child.layoutPositioning !== 'ABSOLUTE' &&
        layoutSizingInParent(parent, child, sizingAxis) !== 'FILL'
    )
}
