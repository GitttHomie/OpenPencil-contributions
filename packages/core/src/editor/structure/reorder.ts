import { assertNodeEditable } from '#core/editor/capabilities'
import { applyMoveStates, captureMoveState } from '#core/editor/history/move'
import type { EditorContext } from '#core/editor/types'
import { computeLayout } from '#core/layout'

export function createStructureReorderActions(ctx: EditorContext) {
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

    doReorderChild(nodeId, parentId, insertIndex)
    if (origParentId !== parentId) ctx.runLayoutForNode(origParentId)
    const final = captureMoveState(ctx.graph, node)

    ctx.undo.push({
      label: 'Reorder',
      forward: () => applyMoveStates(ctx, new Map([[nodeId, final]])),
      inverse: () => applyMoveStates(ctx, new Map([[nodeId, original]]))
    })
  }

  function reorderChildWithUndo(nodeId: string, newParentId: string, insertIndex: number) {
    assertNodeEditable(ctx.graph, nodeId)
    assertNodeEditable(ctx.graph, newParentId)
    const node = ctx.graph.getNode(nodeId)
    if (!node) return
    const origParentId = node.parentId ?? ctx.state.currentPageId
    const original = captureMoveState(ctx.graph, node)

    ctx.graph.reparentNode(nodeId, newParentId)
    ctx.graph.reorderChild(nodeId, newParentId, insertIndex)
    ctx.runLayoutForNode(newParentId)
    if (origParentId !== newParentId) ctx.runLayoutForNode(origParentId)
    const final = captureMoveState(ctx.graph, node)

    ctx.undo.push({
      label: 'Reorder',
      forward: () => applyMoveStates(ctx, new Map([[nodeId, final]])),
      inverse: () => applyMoveStates(ctx, new Map([[nodeId, original]]))
    })
  }

  function applyChildOrder(parentId: string, childIds: readonly string[]) {
    assertNodeEditable(ctx.graph, parentId)
    for (const childId of childIds) assertNodeEditable(ctx.graph, childId)
    const current = ctx.graph.getNode(parentId)?.childIds ?? []
    for (const [index, childId] of childIds.entries()) {
      if (current[index] === childId) continue
      ctx.graph.insertChildAt(childId, parentId, index)
    }
    ctx.runLayoutForNode(parentId)
    ctx.requestRender()
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
      applyChildOrder(parentId, next)
    }
    if (after.size === 0) return

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
    reorderInAutoLayout,
    reorderChildWithUndo,
    bringForward,
    sendBackward,
    bringToFront,
    sendToBack
  }
}
