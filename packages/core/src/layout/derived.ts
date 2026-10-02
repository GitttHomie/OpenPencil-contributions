import type { SceneNode } from '@open-pencil/scene-graph'

/** Explicit sizing/layout edits supersede geometry materialized when a file was read. */
export function hasEditedLayout(node: SceneNode): boolean {
  return node.source.editedFields.some((key) =>
    [
      'layoutMode',
      'primaryAxisSizing',
      'counterAxisSizing',
      'layoutGrow',
      'layoutAlignSelf'
    ].includes(key)
  )
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
