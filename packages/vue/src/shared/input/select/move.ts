import {
  captureMoveState,
  getNodeEditCapability,
  type Editor,
  type MoveState
} from '@open-pencil/core/editor'

import { duplicateAndDrag } from '#vue/shared/input/duplicate-drag'
import { collectFlowDrags } from '#vue/shared/input/flow-reorder'
import type { DragState } from '#vue/shared/input/types'

export function selectionIsLocked(editor: Editor) {
  return [...editor.state.selectedIds].every((id) => editor.graph.getNode(id)?.locked)
}

function autoLayoutMoveTarget(id: string, editor: Editor): string {
  let current = editor.graph.getNode(id)
  let target = current

  while (current?.parentId) {
    const parent = editor.graph.getNode(current.parentId)
    if (!parent) break
    if (
      current.type === 'INSTANCE' &&
      parent.layoutMode !== 'NONE' &&
      current.layoutPositioning !== 'ABSOLUTE'
    ) {
      target = current
    }
    current = parent
  }

  return target?.id ?? id
}

function collectMoveStates(editor: Editor) {
  const originals = new Map<string, MoveState>()
  const movingIds = new Set(
    [...editor.state.selectedIds].map((id) => autoLayoutMoveTarget(id, editor))
  )
  for (const id of movingIds) {
    const node = editor.graph.getNode(id)
    if (!node || !getNodeEditCapability(editor.graph, id).editable) continue
    let ancestor = node
    let skip = node.locked
    while (ancestor.parentId) {
      const parent = editor.graph.getNode(ancestor.parentId)
      if (!parent) break
      if (parent.locked || movingIds.has(parent.id)) skip = true
      ancestor = parent
    }
    if (!skip) originals.set(id, captureMoveState(editor.graph, node))
  }
  return originals
}

function detectDragAutoLayoutParent(originals: Map<string, MoveState>, editor: Editor) {
  if (originals.size === 0) return undefined
  const [id, original] = [...originals][0]
  const node = editor.graph.getNode(id)
  const parent = editor.graph.getNode(original.parentId)
  if (
    parent &&
    parent.layoutMode !== 'NONE' &&
    node?.layoutPositioning !== 'ABSOLUTE' &&
    [...originals].every(
      ([id, state]) =>
        state.parentId === parent.id && editor.graph.getNode(id)?.layoutPositioning !== 'ABSOLUTE'
    )
  ) {
    return parent.id
  }
  return undefined
}

export function createSelectionMoveDrag(
  cx: number,
  cy: number,
  sx: number,
  sy: number,
  editor: Editor,
  duplicate: boolean
): DragState {
  if (duplicate && editor.state.selectedIds.size > 0)
    return duplicateAndDrag(cx, cy, sx, sy, editor).drag

  const originals = collectMoveStates(editor)

  return {
    type: 'move',
    startX: cx,
    startY: cy,
    currentX: cx,
    currentY: cy,
    appliedDx: 0,
    appliedDy: 0,
    startScreenX: sx,
    startScreenY: sy,
    dragStarted: false,
    originals,
    autoLayoutParentId: detectDragAutoLayoutParent(originals, editor),
    flows: collectFlowDrags(originals, editor)
  }
}
