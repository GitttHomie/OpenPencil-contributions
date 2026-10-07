import {
  cloneInstanceOverrideState,
  findInstanceAncestor,
  recordInstanceOverride,
  slotScope,
  type InstanceOverrideState
} from '@open-pencil/scene-graph'

import { getNodeEditCapability } from '#core/editor/capabilities'
import { prepareSlotEdits } from '#core/editor/components/slots/index'
import type { EditorContext } from '#core/editor/types'

import { type DeletedEntry, restoreDeletedEntries } from './history'
import { snapshotSubtree } from './subtree-history'

export function deleteNodes(
  ctx: EditorContext,
  nodeIds: Iterable<string>,
  nextSelection?: ReadonlySet<string>
) {
  const entries: DeletedEntry[] = []
  const hidden: { id: string; visible: boolean; parentId: string }[] = []
  const overrides = new Map<string, InstanceOverrideState>()
  const selected = new Set(
    [...nodeIds].filter((id) => {
      const node = ctx.graph.getNode(id)
      return node && !node.locked && getNodeEditCapability(ctx.graph, id).editable
    })
  )
  for (const id of selected) {
    const node = ctx.graph.getNode(id)
    if (!node) continue
    let ancestor = node.parentId ? ctx.graph.getNode(node.parentId) : undefined
    let selectedAncestor = false
    while (ancestor) {
      if (selected.has(ancestor.id)) {
        selectedAncestor = true
        break
      }
      ancestor = ancestor.parentId ? ctx.graph.getNode(ancestor.parentId) : undefined
    }
    if (selectedAncestor) continue
    const parentId = node.parentId ?? ctx.state.currentPageId
    // The whole instance can be removed; its descendants retain the definition's structure.
    if (slotScope(ctx.graph, parentId).kind === 'locked') {
      if (!node.visible) continue
      hidden.push({ id, visible: node.visible, parentId })
      const owner = findInstanceAncestor(ctx.graph, id)
      if (owner && !overrides.has(owner.id))
        overrides.set(owner.id, cloneInstanceOverrideState(owner.instanceOverrides))
    } else {
      const index = ctx.graph.getNode(parentId)?.childIds.indexOf(id) ?? -1
      entries.push({ id, parentId, index, subtree: snapshotSubtree(ctx.graph, id) })
    }
  }
  if (entries.length === 0 && hidden.length === 0) return

  const relayout = () => {
    for (const parentId of new Set([...entries, ...hidden].map((entry) => entry.parentId)))
      ctx.runLayoutForNode(parentId)
  }
  const previousSelection = new Set(ctx.state.selectedIds)
  const selectionAfter =
    nextSelection ?? new Set([...previousSelection].filter((id) => !selected.has(id)))
  const forward = () => {
    for (const { id } of hidden) {
      ctx.graph.updateNode(id, { visible: false })
      recordInstanceOverride(ctx.graph, id, ['visible'])
    }
    for (const { id } of entries) ctx.graph.deleteNode(id)
    relayout()
    ctx.setSelectedIds(new Set(selectionAfter))
  }
  ctx.undo.runBatch(entries.length === 0 ? 'Hide' : 'Delete', () => {
    if (
      !prepareSlotEdits(
        ctx,
        entries.map((entry) => entry.parentId)
      )
    )
      return
    for (const entry of entries) entry.subtree = snapshotSubtree(ctx.graph, entry.id)
    forward()
    ctx.undo.push({
      label: entries.length === 0 ? 'Hide' : 'Delete',
      forward,
      inverse: () => {
        restoreDeletedEntries(ctx, entries)
        for (const { id, visible } of hidden) ctx.graph.updateNode(id, { visible })
        for (const [id, state] of overrides)
          ctx.graph.updateNode(id, { instanceOverrides: cloneInstanceOverrideState(state) })
        relayout()
        ctx.setSelectedIds(previousSelection)
      }
    })
  })
}

export function deleteSelected(ctx: EditorContext) {
  deleteNodes(ctx, ctx.state.selectedIds, new Set())
}
