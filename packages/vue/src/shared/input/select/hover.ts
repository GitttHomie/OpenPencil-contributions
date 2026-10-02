import { getNodeEditCapability, type Editor } from '@open-pencil/core/editor'

import {
  buildResizeCursor,
  cornerRotationCursor,
  getHitHandleByMatrix,
  hitTestCornerRotationByMatrix
} from '#vue/shared/input/geometry'
import type { HitTestFns } from '#vue/shared/input/select'
import { resolveLabelHit } from '#vue/shared/input/select/hit'
import { getNodeEditState } from '#vue/shared/input/vector'

function getResizeCursorForSelection(cx: number, cy: number, editor: Editor): string | null {
  for (const id of editor.state.selectedIds) {
    const node = editor.graph.getNode(id)
    if (!node) continue

    const handleHit = getHitHandleByMatrix(
      cx,
      cy,
      node,
      editor.graph,
      editor.renderer?.zoom ?? 1,
      editor.state.rotationPreview
    )
    if (handleHit?.handle) return buildResizeCursor(handleHit.rotation)
  }
  return null
}

function getRotationCursorForSelection(cx: number, cy: number, editor: Editor): string | null {
  if (editor.state.selectedIds.size !== 1) return null

  const id = [...editor.state.selectedIds][0]
  const node = editor.graph.getNode(id)
  if (!node) return null

  const corner = hitTestCornerRotationByMatrix(
    cx,
    cy,
    node,
    editor.graph,
    editor.renderer?.zoom ?? 1,
    editor.state.rotationPreview
  )
  if (!corner) return null

  return cornerRotationCursor(corner, node, editor.graph, editor.state.rotationPreview)
}

function updateHoveredNode(cx: number, cy: number, editor: Editor, fns: HitTestFns, deep: boolean) {
  const hit = deep
    ? fns.hitTestInScope(cx, cy, true)
    : (resolveLabelHit(cx, cy, fns) ?? fns.hitTestInScope(cx, cy, false))
  const editNodeId = getNodeEditState(editor)?.nodeId
  editor.setHoveredNode(
    hit && !editor.state.selectedIds.has(hit.id) && hit.id !== editNodeId ? hit.id : null
  )
}

export function updateHoverCursor(
  cx: number,
  cy: number,
  editor: Editor,
  fns: HitTestFns,
  deep = false
): string | null {
  if (getNodeEditState(editor)) {
    editor.setHoveredNode(null)
    return null
  }

  const label = resolveLabelHit(cx, cy, fns)
  if (label) {
    updateHoveredNode(cx, cy, editor, fns, false)
    return !label.locked && getNodeEditCapability(editor.graph, label.id).editable ? 'move' : null
  }
  const cursor =
    getResizeCursorForSelection(cx, cy, editor) ?? getRotationCursorForSelection(cx, cy, editor)
  updateHoveredNode(cx, cy, editor, fns, deep)
  return cursor
}
