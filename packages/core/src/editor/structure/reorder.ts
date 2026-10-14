import { createsComponentCycle } from '@open-pencil/scene-graph'

import { assertNodeEditable } from '#core/editor/capabilities'
import { prepareSlotEdits } from '#core/editor/components/slots/index'
import { applyMoveStates, captureMoveState, type MoveState } from '#core/editor/history/move'
import type { EditorContext } from '#core/editor/types'
import { computeLayout } from '#core/layout'

export function createStructureReorderActions(ctx: EditorContext) {
  function recordReorder(nodeId: string, original: MoveState) {
    const node = ctx.graph.getNode(nodeId)
    if (!node) return
    const final = captureMoveState(ctx.graph, node)
    ctx.undo.push({
      label: 'Reorder',
      forward: () => applyMoveStates(ctx, new Map([[nodeId, final]])),
      inverse: () => applyMoveStates(ctx, new Map([[nodeId, original]]))
    })
  }

  function doReorderChild(nodeId: string, parentId: string, insertIndex: number) {
    assertNodeEditable(ctx.graph, nodeId)
    assertNodeEditable(ctx.graph, parentId)
    const node = ctx.graph.getNode(nodeId)
    if (!node) return

    if (node.parentId !== parentId) {
      ctx.graph.reparentNode(nodeId, parentId)
    }

    ctx.graph.reorderChild(nodeId, parentId, insertIndex)
    computeLayout(ctx.graph, parentId)
    ctx.runLayoutForNode(parentId)
  }

  function reorderInAutoLayout(nodeId: string, parentId: string, insertIndex: number) {
    const parent = ctx.graph.getNode(parentId)
    if (!parent || parent.layoutMode === 'NONE') return

    const node = ctx.graph.getNode(nodeId)
    if (!node) return
    const origParentId = node.parentId ?? ctx.state.currentPageId
    const original = captureMoveState(ctx.graph, node)
    if (!prepareSlotEdits(ctx, [origParentId, parentId])) return

    doReorderChild(nodeId, parentId, insertIndex)
    if (origParentId !== parentId) ctx.runLayoutForNode(origParentId)
    recordReorder(nodeId, original)
  }

  /**
   * Moves a layer to `insertIndex` among `newParentId`'s children, counted without the layer. A
   * new parent keeps the layer where it is drawn, as moving it into a frame on the canvas does, and
   * is refused when it would put a component inside itself.
   */
  function reorderChildWithUndo(nodeId: string, newParentId: string, insertIndex: number) {
    assertNodeEditable(ctx.graph, nodeId)
    assertNodeEditable(ctx.graph, newParentId)
    const node = ctx.graph.getNode(nodeId)
    if (!node) return
    const origParentId = node.parentId ?? ctx.state.currentPageId
    const reparents = origParentId !== newParentId
    if (reparents && createsComponentCycle(ctx.graph, nodeId, newParentId)) return
    const original = captureMoveState(ctx.graph, node)
    if (!prepareSlotEdits(ctx, [origParentId, newParentId])) return

    if (reparents) ctx.graph.reparentNode(nodeId, newParentId)

    ctx.graph.reorderChild(nodeId, newParentId, insertIndex)
    ctx.runLayoutForNode(newParentId)
    if (origParentId !== newParentId) ctx.runLayoutForNode(origParentId)
    recordReorder(nodeId, original)
  }

  /**
   * Puts a frame's children in `childIds`. Only the children it moves need to be editable, so a
   * read-only library layer that keeps its place does not block reordering its siblings.
   */
  function applyChildOrder(parentId: string, childIds: readonly string[]) {
    assertNodeEditable(ctx.graph, parentId)
    const current = ctx.graph.getNode(parentId)?.childIds ?? []
    const moved = childIds.filter((childId, index) => current[index] !== childId)
    for (const childId of moved) assertNodeEditable(ctx.graph, childId)
    for (const [index, childId] of childIds.entries()) {
      if (ctx.graph.getNode(parentId)?.childIds[index] === childId) continue
      ctx.graph.insertChildAt(childId, parentId, index)
    }
    ctx.runLayoutForNode(parentId)
    ctx.requestRender()
  }

  /** Puts a frame's children in `order` as one undo step, laying the frame out once. */
  function setChildOrder(parentId: string, order: readonly string[], label = 'Reorder') {
    const before = ctx.graph.getNode(parentId)?.childIds
    if (!before || order.every((id, index) => id === before[index])) return
    if (!prepareSlotEdits(ctx, [parentId])) return
    const previous = [...before]
    const next = [...order]
    applyChildOrder(parentId, next)
    ctx.undo.push({
      label,
      forward: () => applyChildOrder(parentId, next),
      inverse: () => applyChildOrder(parentId, previous)
    })
  }

  function moveSelectionInZOrder(
    label: string,
    reorder: (childIds: readonly string[], selectedIds: ReadonlySet<string>) => string[]
  ) {
    const selectedIds = ctx.state.selectedIds
    for (const id of selectedIds) assertNodeEditable(ctx.graph, id)
    const parentIds = new Set<string>()
    for (const id of selectedIds) {
      const parentId = ctx.graph.getNode(id)?.parentId
      if (parentId) parentIds.add(parentId)
    }

    const before = new Map<string, string[]>()
    const after = new Map<string, string[]>()
    for (const parentId of parentIds) {
      const childIds = ctx.graph.getNode(parentId)?.childIds
      if (!childIds) continue
      const next = reorder(childIds, selectedIds)
      if (next.every((id, index) => id === childIds[index])) continue
      before.set(parentId, [...childIds])
      after.set(parentId, next)
    }
    if (after.size === 0) return
    if (!prepareSlotEdits(ctx, after.keys())) return
    for (const [parentId, childIds] of after) applyChildOrder(parentId, childIds)

    ctx.undo.push({
      label,
      forward: () => {
        for (const [parentId, childIds] of after) applyChildOrder(parentId, childIds)
      },
      inverse: () => {
        for (const [parentId, childIds] of before) applyChildOrder(parentId, childIds)
      }
    })
  }

  function moveAdjacent(
    childIds: readonly string[],
    selectedIds: ReadonlySet<string>,
    direction: 'forward' | 'backward'
  ) {
    const result = [...childIds]
    const start = direction === 'forward' ? result.length - 2 : 1
    const end = direction === 'forward' ? -1 : result.length
    const step = direction === 'forward' ? -1 : 1
    for (let index = start; index !== end; index += step) {
      const neighborIndex = index - step
      const current = result[index]
      const neighbor = result[neighborIndex]
      if (current && neighbor && selectedIds.has(current) && !selectedIds.has(neighbor)) {
        result[index] = neighbor
        result[neighborIndex] = current
      }
    }
    return result
  }

  function bringForward() {
    moveSelectionInZOrder('Bring forward', (childIds, selectedIds) =>
      moveAdjacent(childIds, selectedIds, 'forward')
    )
  }

  function sendBackward() {
    moveSelectionInZOrder('Send backward', (childIds, selectedIds) =>
      moveAdjacent(childIds, selectedIds, 'backward')
    )
  }

  function bringToFront() {
    moveSelectionInZOrder('Bring to front', (childIds, selectedIds) => [
      ...childIds.filter((id) => !selectedIds.has(id)),
      ...childIds.filter((id) => selectedIds.has(id))
    ])
  }

  function sendToBack() {
    moveSelectionInZOrder('Send to back', (childIds, selectedIds) => [
      ...childIds.filter((id) => selectedIds.has(id)),
      ...childIds.filter((id) => !selectedIds.has(id))
    ])
  }

  return {
    setChildOrder,
    reorderInAutoLayout: (nodeId: string, parentId: string, insertIndex: number) =>
      ctx.undo.runBatch('Reorder', () => reorderInAutoLayout(nodeId, parentId, insertIndex)),
    reorderChildWithUndo: (nodeId: string, parentId: string, insertIndex: number) =>
      ctx.undo.runBatch('Reorder', () => reorderChildWithUndo(nodeId, parentId, insertIndex)),
    bringForward: () => ctx.undo.runBatch('Bring forward', bringForward),
    sendBackward: () => ctx.undo.runBatch('Send backward', sendBackward),
    bringToFront: () => ctx.undo.runBatch('Bring to front', bringToFront),
    sendToBack: () => ctx.undo.runBatch('Send to back', sendToBack)
  }
}
