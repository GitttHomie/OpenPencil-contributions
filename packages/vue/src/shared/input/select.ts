import { getNodeEditState, handleNodeEditDown } from '#vue/shared/input/vector'
export { resolveHit } from '#vue/shared/input/select/hit'
import { hitTestLabel, resolveHit, tinySelectionAt } from '#vue/shared/input/select/hit'
export { updateHoverCursor } from '#vue/shared/input/select/hover'
import { editedGradient, type Editor } from '@open-pencil/core/editor'
import type { SceneNode } from '@open-pencil/scene-graph'

import { tryStartGradientDrag } from '#vue/shared/input/gradient'
import { tryStartResize } from '#vue/shared/input/resize'
import { createSelectionMoveDrag, selectionIsLocked } from '#vue/shared/input/select/move'
import { tryStartShapeHandleDrag } from '#vue/shared/input/shape-handles'
import type { DragState } from '#vue/shared/input/types'

export interface HitTestFns {
  hitTestInScope: (cx: number, cy: number, deep: boolean) => SceneNode | null
  isInsideContainerBounds: (cx: number, cy: number, containerId: string) => boolean
  hitTestSectionTitle: (cx: number, cy: number) => SceneNode | null
  hitTestComponentLabel: (cx: number, cy: number) => SceneNode | null
  hitTestFrameTitle: (cx: number, cy: number) => SceneNode | null
}

/**
 * Starts dragging a gradient handle, or else the selection's corner radius, resize, or rotation
 * handles. A layer's label takes the press before rotation but after resizing, as in Figma.
 */
function tryStartHandleDrag(
  cx: number,
  cy: number,
  sx: number,
  sy: number,
  altKey: boolean,
  editor: Editor,
  fns: HitTestFns,
  tryStartRotation: (cx: number, cy: number) => boolean,
  setDrag: (d: DragState) => void
): boolean {
  if (tryStartGradientDrag(editor, sx, sy, setDrag)) return true
  // An open gradient's handles replace the layer's selection handles, which then do not respond.
  if (editedGradient(editor.graph, editor.state.gradientEdit)) return false
  if (tryStartShapeHandleDrag(editor, sx, sy, altKey, setDrag)) return true
  const resizeDrag = tryStartResize(cx, cy, editor)
  if (resizeDrag) {
    setDrag(resizeDrag)
    return true
  }
  return !hitTestLabel(cx, cy, fns) && tryStartRotation(cx, cy)
}

function canMarqueeSection(e: MouseEvent, hit: SceneNode | null): hit is SceneNode {
  return !(e.metaKey || e.ctrlKey || e.shiftKey) && hit?.type === 'SECTION'
}

export function handleSelectDown(
  e: MouseEvent,
  cx: number,
  cy: number,
  sx: number,
  sy: number,
  editor: Editor,
  fns: HitTestFns,
  tryStartRotation: (cx: number, cy: number) => boolean,
  handleTextEditClick: (cx: number, cy: number, shiftKey: boolean) => boolean,
  setDrag: (d: DragState) => void
) {
  // Node edit mode intercept
  if (getNodeEditState(editor)) {
    handleNodeEditDown(e, cx, cy, editor, setDrag)
    return
  }

  const deep = e.metaKey || e.ctrlKey
  if (editor.state.editingTextId) {
    if (!deep && handleTextEditClick(cx, cy, e.shiftKey)) return
    editor.commitTextEdit()
  }

  if (!deep && tryStartHandleDrag(cx, cy, sx, sy, e.altKey, editor, fns, tryStartRotation, setDrag))
    return

  const leaf = fns.hitTestInScope(cx, cy, true)
  if (canMarqueeSection(e, leaf) && !hitTestLabel(cx, cy, fns)) {
    editor.clearSelection()
    setDrag({ type: 'marquee', startX: cx, startY: cy, containerId: leaf.id })
    return
  }

  const hit = deep ? leaf : (tinySelectionAt(cx, cy, editor) ?? resolveHit(cx, cy, editor, fns))
  if (!hit) {
    if (!editor.state.enteredContainerId) {
      editor.clearSelection()
      setDrag({ type: 'marquee', startX: cx, startY: cy })
    }
    return
  }

  if (deep) {
    editor.state.enteredContainerId =
      hit.parentId === editor.state.currentPageId ? null : hit.parentId
  }

  if (!editor.state.selectedIds.has(hit.id) && !e.shiftKey) {
    editor.select([hit.id])
  } else if (e.shiftKey) {
    editor.select([hit.id], true)
  }

  if (selectionIsLocked(editor)) return

  setDrag(createSelectionMoveDrag(cx, cy, sx, sy, editor, e.altKey))
}
