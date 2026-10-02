import type { Editor } from '@open-pencil/core/editor'
import type { SceneNode } from '@open-pencil/scene-graph'

export function findMoveDropTarget(
  cx: number,
  cy: number,
  editor: Editor,
  movingIds = editor.state.selectedIds
): SceneNode | null {
  let dropTarget = editor.graph.hitTestFrame(cx, cy, movingIds, editor.state.currentPageId)
  const movingSection = [...movingIds].some((id) => editor.graph.getNode(id)?.type === 'SECTION')
  if (movingSection)
    while (dropTarget && dropTarget.type !== 'SECTION' && dropTarget.type !== 'CANVAS') {
      dropTarget = dropTarget.parentId ? (editor.graph.getNode(dropTarget.parentId) ?? null) : null
    }
  return dropTarget
}
