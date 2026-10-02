import {
  computeAutoLayoutIndicator,
  computeAutoLayoutIndicatorForFrame
} from '#vue/shared/input/auto-layout'
import {
  isPastPointerDragThreshold,
  POINTER_DRAG_START_THRESHOLD_PX
} from '#vue/shared/input/drag-threshold'
import { findMoveDropTarget } from '#vue/shared/input/drop-target'
export { duplicateAndDrag } from '#vue/shared/input/duplicate-drag'
import type { Editor } from '@open-pencil/core/editor'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import Matrix from '@open-pencil/scene-graph/matrix'

import { applyMoveSnap } from '#vue/shared/input/move-snap'
import { worldDeltaToParentLocal } from '#vue/shared/input/snap'
import type { DragMove } from '#vue/shared/input/types'

const AUTO_LAYOUT_REORDER_CLICK_SLOP = 3
const AUTO_LAYOUT_EXIT_SLOP_PX = 8
export const MOVE_DRAG_START_THRESHOLD_PX = POINTER_DRAG_START_THRESHOLD_PX

function isInsideAutoLayoutDragBounds(parentId: string, cx: number, cy: number, editor: Editor) {
  const parent = editor.graph.getNode(parentId)
  if (!parent) return false
  const inverse = Matrix.invert(getWorldMatrix(parent, editor.graph))
  if (!inverse) return false
  const point = Matrix.mapPoint(inverse, { x: cx, y: cy })
  const slop = AUTO_LAYOUT_EXIT_SLOP_PX / editor.state.zoom
  return (
    point.x >= -slop &&
    point.x <= parent.width + slop &&
    point.y >= -slop &&
    point.y <= parent.height + slop
  )
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

function previewMove(d: DragMove, dx: number, dy: number, editor: Editor, round = false) {
  d.previewPositions = new Map()
  for (const [id, orig] of d.originals) {
    const delta = worldDeltaToParentLocal({ x: dx, y: dy }, orig.parentId, editor)
    const x = round ? Math.round(orig.x + delta.x) : orig.x + delta.x
    const y = round ? Math.round(orig.y + delta.y) : orig.y + delta.y
    if (d.previewPositions.size === 0) {
      d.appliedDx = x - orig.x
      d.appliedDy = y - orig.y
    }
    d.previewPositions.set(id, { x, y })
    editor.graph.updateNodePositionPreview(id, x, y)
  }
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

  if (d.autoLayoutParentId && !d.brokeFromAutoLayout) {
    if (isInsideAutoLayoutDragBounds(d.autoLayoutParentId, cx, cy, editor)) {
      computeAutoLayoutIndicator(d, cx, cy, editor)
      return
    }
    d.brokeFromAutoLayout = true
    editor.setLayoutInsertIndicator(null)
  }

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
    previewMove(d, dx, dy, editor, !disableSnapping && editor.state.snappingPreferences.pixelGrid)
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
  applyFinalPositions(d, editor)
  const dropId = indicator?.parentId ?? editor.state.dropTargetId ?? editor.state.currentPageId
  const ids = [...d.originals.keys()].sort((a, b) => {
    const first = d.originals.get(a)
    const second = d.originals.get(b)
    return first?.parentId === second?.parentId ? (first?.index ?? 0) - (second?.index ?? 0) : 0
  })
  const parents = new Set([...d.originals.values()].map((original) => original.parentId))
  parents.add(dropId)
  for (const id of ids) {
    const node = editor.graph.getNode(id)
    if (!node) continue
    if (node.parentId !== dropId) {
      editor.graph.updateNode(id, {
        primaryAxisSizing: node.primaryAxisSizing === 'FILL' ? 'FIXED' : node.primaryAxisSizing,
        counterAxisSizing: node.counterAxisSizing === 'FILL' ? 'FIXED' : node.counterAxisSizing
      })
    }
    editor.graph.reparentNode(id, dropId)
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

  if (indicator && getMoveDistance(d) < AUTO_LAYOUT_REORDER_CLICK_SLOP) {
    cancelMove(d, editor)
    return
  }

  const moved = Boolean(indicator) || hasMoved(d, editor)
  if (moved) finishMove(d, editor, indicator)

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
  editor.setDropTarget(null)
}
