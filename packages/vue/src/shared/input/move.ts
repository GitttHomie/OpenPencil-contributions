import {
  computeAutoLayoutIndicator,
  computeIndicatorPosition,
  computeAutoLayoutIndicatorForFrame
} from '#vue/shared/input/auto-layout'
import {
  isPastPointerDragThreshold,
  POINTER_DRAG_START_THRESHOLD_PX
} from '#vue/shared/input/drag-threshold'
import { findMoveDropTarget } from '#vue/shared/input/drop-target'
export { duplicateAndDrag } from '#vue/shared/input/duplicate-drag'
import type { Editor } from '@open-pencil/core/editor'

import { flowBlockBounds, flowOrder, flowSlot, type FlowDrag } from '#vue/shared/input/flow-reorder'
import { applyMoveSnap } from '#vue/shared/input/move-snap'
import { worldDeltaToParentLocal } from '#vue/shared/input/snap'
import type { DragMove } from '#vue/shared/input/types'

const AUTO_LAYOUT_REORDER_CLICK_SLOP = 3
/**
 * How far past its auto layout frame's edge a dragged layer's near edge goes before the layer
 * leaves the frame, in canvas units, as measured in Figma desktop 126: 5 across the flow, and
 * 13 to 20 along it depending on the layer's size.
 */
const AUTO_LAYOUT_LEAVE_MARGIN_ACROSS = 5
const AUTO_LAYOUT_LEAVE_MARGIN_ALONG = 15
export const MOVE_DRAG_START_THRESHOLD_PX = POINTER_DRAG_START_THRESHOLD_PX

/** Whether layers whose box in the frame's own space is `bounds` stay close enough to its flow. */
function staysInAutoLayout(
  parentId: string,
  bounds: { left: number; top: number; right: number; bottom: number },
  editor: Editor
) {
  const parent = editor.graph.getNode(parentId)
  if (!parent) return false
  // How far the layers' near edge is past the frame's edge on each of the frame's own axes, with
  // `bounds` in the frame's space; negative while they overlap.
  const pastX = Math.max(-bounds.right, bounds.left - parent.width)
  const pastY = Math.max(-bounds.bottom, bounds.top - parent.height)
  const isRow = parent.layoutMode === 'HORIZONTAL'
  const along = isRow ? pastX : pastY
  const across = isRow ? pastY : pastX
  return along <= AUTO_LAYOUT_LEAVE_MARGIN_ALONG && across <= AUTO_LAYOUT_LEAVE_MARGIN_ACROSS
}

/**
 * Keeps dragged layers in their flows while they stay close, as Figma does: each flow's block
 * takes the slot the drag has reached, which the indicator shows for the first flow that moved.
 * Returns false once a flow's layers leave it, and the move goes on as a free drag.
 */
function dragAlongFlows(d: DragMove, flows: FlowDrag[], dx: number, dy: number, editor: Editor) {
  if (d.ignoreAutoLayout) return false
  if (
    !flows.every((flow) =>
      staysInAutoLayout(flow.parentId, flowBlockBounds(flow, dx, dy, editor), editor)
    )
  )
    return false
  d.flowSlots = flows.map((flow) => flowSlot(flow, dx, dy, editor))
  const moved = flows.findIndex((flow, i) => d.flowSlots?.[i] !== flow.start)
  const flow = moved === -1 ? undefined : flows[moved]
  const parent = flow && editor.graph.getNode(flow.parentId)
  if (!flow || !parent) {
    editor.setLayoutInsertIndicator(null)
    return true
  }
  const isRow = parent.layoutMode === 'HORIZONTAL'
  const others = flow.others.flatMap((id) => editor.graph.getNode(id) ?? [])
  const parentAbs = editor.graph.getAbsolutePosition(parent.id)
  const position = computeIndicatorPosition(
    others,
    d.flowSlots[moved],
    parent,
    parentAbs,
    isRow,
    editor
  )
  editor.setLayoutInsertIndicator({
    parentId: parent.id,
    index: d.flowSlots[moved],
    x: isRow ? position : parentAbs.x + parent.paddingLeft,
    y: isRow ? parentAbs.y + parent.paddingTop : position,
    length: isRow
      ? parent.height - parent.paddingTop - parent.paddingBottom
      : parent.width - parent.paddingLeft - parent.paddingRight,
    direction: isRow ? 'VERTICAL' : 'HORIZONTAL'
  })
  return true
}

/** Puts each flow's block in the slot the drag reached, as one undo step. */
function dropAlongFlows(d: DragMove, flows: FlowDrag[], editor: Editor) {
  editor.undo.runBatch('Reorder', () => {
    for (const [i, flow] of flows.entries()) {
      const slot = d.flowSlots?.[i] ?? flow.start
      if (slot === flow.start) continue
      editor.setChildOrder(flow.parentId, flowOrder(flow, slot, editor))
    }
  })
}

export function detectAutoLayoutParent(editor: Editor): string | undefined {
  if (editor.state.selectedIds.size !== 1) return undefined
  const selectedId = [...editor.state.selectedIds][0]
  const selectedNode = editor.graph.getNode(selectedId)
  if (!selectedNode?.parentId) return undefined
  const parent = editor.graph.getNode(selectedNode.parentId)
  if (parent && parent.layoutMode !== 'NONE' && selectedNode.layoutPositioning !== 'ABSOLUTE') {
    return parent.id
  }
  return undefined
}

function isPastDragStartThreshold(d: DragMove, sx: number, sy: number) {
  return isPastPointerDragThreshold(d.startScreenX, d.startScreenY, sx, sy)
}

function previewMove(d: DragMove, dx: number, dy: number, editor: Editor) {
  d.previewPositions = new Map()
  for (const [id, orig] of d.originals) {
    const delta = worldDeltaToParentLocal({ x: dx, y: dy }, orig.parentId, editor)
    const { x, y } = editor.snapGeometry({ x: orig.x + delta.x, y: orig.y + delta.y })
    if (d.previewPositions.size === 0) {
      d.appliedDx = x - orig.x
      d.appliedDy = y - orig.y
    }
    d.previewPositions.set(id, { x, y })
    editor.graph.updateNodePositionPreview(id, x, y)
  }
}

/**
 * Keeps a move in the auto layout the layers started in while they stay close to it; returns
 * whether it did. Once they leave, the move goes on as a free drag.
 */
function keepsOwnAutoLayout(
  d: DragMove,
  dx: number,
  dy: number,
  cx: number,
  cy: number,
  editor: Editor
): boolean {
  if (d.flows) {
    if (dragAlongFlows(d, d.flows, dx, dy, editor)) return true
    d.flowSlots = undefined
  } else if (d.autoLayoutParentId && !d.ignoreAutoLayout) {
    // A wrapped flow, which still reorders by the cursor.
    const [id] = d.originals.keys()
    const block = { parentId: d.autoLayoutParentId, ids: id ? [id] : [], others: [], start: 0 }
    if (staysInAutoLayout(d.autoLayoutParentId, flowBlockBounds(block, dx, dy, editor), editor)) {
      computeAutoLayoutIndicator(d, cx, cy, editor)
      return true
    }
  } else if (!d.autoLayoutParentId) {
    return false
  }
  d.brokeFromAutoLayout = true
  editor.setLayoutInsertIndicator(null)
  return false
}

export function handleMoveMove(
  d: DragMove,
  cx: number,
  cy: number,
  sx: number,
  sy: number,
  editor: Editor,
  disableSnapping = false
) {
  if (d.originals.size === 0) return
  d.currentX = cx
  d.currentY = cy

  if (!d.dragStarted) {
    if (!isPastDragStartThreshold(d, sx, sy)) return
    d.dragStarted = true
  }

  const dx = cx - d.startX
  const dy = cy - d.startY

  if (!d.brokeFromAutoLayout && keepsOwnAutoLayout(d, dx, dy, cx, cy, editor)) return

  const movingIds = new Set(d.originals.keys())
  const dropTarget = findMoveDropTarget(cx, cy, editor, movingIds)
  const dropParent = dropTarget ? editor.graph.getNode(dropTarget.id) : null

  const keepingAbsolutePosition =
    dropParent &&
    [...movingIds].every((id) => {
      const node = editor.graph.getNode(id)
      return node?.parentId === dropParent.id && node.layoutPositioning === 'ABSOLUTE'
    })
  if (dropParent && dropParent.layoutMode !== 'NONE' && !keepingAbsolutePosition) {
    computeAutoLayoutIndicatorForFrame(dropParent, cx, cy, editor, movingIds)
    editor.setDropTarget(dropParent.id)
    previewMove(d, dx, dy, editor)
    editor.requestRepaint()
    return
  }

  editor.setLayoutInsertIndicator(null)

  const snapped = applyMoveSnap(d, dx, dy, editor, disableSnapping)
  previewMove(d, snapped.worldDx, snapped.worldDy, editor)

  editor.setDropTarget(dropTarget?.id ?? null)
  editor.requestRepaint()
}

function getMoveDistance(d: DragMove) {
  return Math.hypot(d.currentX - d.startX, d.currentY - d.startY)
}

function hasMoved(d: DragMove, editor: Editor) {
  return [...d.originals].some(([id, orig]) => {
    const node = editor.graph.getNode(id)
    return node && (node.x !== orig.x || node.y !== orig.y)
  })
}

function restoreOriginalPositions(d: DragMove, editor: Editor) {
  for (const [id, orig] of d.originals) {
    editor.graph.updateNodePositionPreview(id, orig.x, orig.y)
  }
}

function applyFinalPositions(d: DragMove, editor: Editor) {
  for (const [id, orig] of d.originals) {
    // Reparent before running layout; otherwise the old layout snaps the node back.
    editor.graph.updateNode(
      id,
      d.previewPositions?.get(id) ?? { x: orig.x + d.appliedDx, y: orig.y + d.appliedDy }
    )
  }
}

export function cancelMove(d: DragMove, editor: Editor) {
  d.finishInteraction?.()
  if (d.isCurrentGraph && !d.isCurrentGraph()) return
  restoreOriginalPositions(d, editor)
  if (d.duplicated) {
    for (const id of [...d.originals.keys()].toReversed()) editor.graph.deleteNode(id)
    editor.select([...(d.duplicatedPreviousSelection ?? [])])
  }
  editor.setLayoutInsertIndicator(null)
  editor.setDropTarget(null)
  editor.setSnapGuides([])
  editor.requestRender()
}

function finishMove(
  d: DragMove,
  editor: Editor,
  indicator: Editor['state']['layoutInsertIndicator']
) {
  restoreOriginalPositions(d, editor)
  const dropId = indicator?.parentId ?? editor.state.dropTargetId ?? editor.state.currentPageId
  const ids = [...d.originals.keys()].sort((a, b) => {
    const first = d.originals.get(a)
    const second = d.originals.get(b)
    return first?.parentId === second?.parentId ? (first?.index ?? 0) - (second?.index ?? 0) : 0
  })
  const parents = new Set([...d.originals.values()].map((original) => original.parentId))
  parents.add(dropId)
  if (!editor.prepareSlotEdits(parents)) {
    restoreOriginalPositions(d, editor)
    return false
  }
  applyFinalPositions(d, editor)
  for (const id of ids) {
    const node = editor.graph.getNode(id)
    if (!node) continue
    editor.graph.reparentNode(id, dropId)
    const reparented = editor.graph.getNode(id)
    if (reparented) {
      editor.graph.updateNode(id, editor.snapGeometry({ x: reparented.x, y: reparented.y }))
    }
    if (indicator) editor.graph.updateNode(id, { layoutPositioning: 'AUTO' })
  }
  if (indicator) {
    // The indicator index is relative to the list with all dragged nodes removed.
    const parent = editor.graph.getNode(dropId)
    const remaining = parent?.childIds.filter((id) => !d.originals.has(id)) ?? []
    const order = [
      ...remaining.slice(0, indicator.index),
      ...ids,
      ...remaining.slice(indicator.index)
    ]
    order.forEach((id, index) => editor.graph.reorderChild(id, dropId, index))
  }
  for (const parentId of parents) editor.runLayoutForNode(parentId)
  return true
}

export function handleMoveUp(d: DragMove, editor: Editor) {
  d.finishInteraction?.()
  if (!d.dragStarted) {
    editor.setLayoutInsertIndicator(null)
    editor.setSnapGuides([])
    editor.setDropTarget(null)
    return
  }

  const indicator = editor.state.layoutInsertIndicator
  editor.setLayoutInsertIndicator(null)
  editor.setSnapGuides([])

  // Slots exist only once the drag started, so a reached slot is a reorder however short the drag.
  if (d.flows && d.flowSlots && !d.brokeFromAutoLayout) {
    dropAlongFlows(d, d.flows, editor)
    editor.setDropTarget(null)
    return
  }

  if (indicator) {
    if (getMoveDistance(d) < AUTO_LAYOUT_REORDER_CLICK_SLOP) {
      editor.setDropTarget(null)
      return
    }
    // Claiming a slot records its own step; the batch makes it one undo with the reorder.
    editor.undo.runBatch('Reorder', () => {
      for (const id of d.originals.keys()) {
        editor.reorderInAutoLayout(id, indicator.parentId, indicator.index)
      }
    })
    editor.setDropTarget(null)
    return
  }

  const moved = hasMoved(d, editor)

  if (d.duplicated && !moved) {
    const previousSelection = d.duplicatedPreviousSelection ?? new Set<string>()
    for (const id of [...d.originals.keys()].toReversed()) editor.graph.deleteNode(id)
    editor.select([...previousSelection])
    editor.requestRender()
    editor.setDropTarget(null)
    return
  }

  editor.undo.runBatch(d.duplicated ? 'Duplicate' : 'Move', () => {
    if (moved && !finishMove(d, editor, indicator)) {
      cancelMove(d, editor)
      return
    }
    if (d.duplicated) {
      const previousSelection = d.duplicatedPreviousSelection ?? new Set<string>()
      if (!moved) {
        cancelMove(d, editor)
        return
      }
      editor.commitDuplicateMove([...d.originals.keys()], previousSelection)
    } else if (moved) {
      editor.commitMoveWithReparent(d.originals)
    }
  })
  editor.setDropTarget(null)
}
