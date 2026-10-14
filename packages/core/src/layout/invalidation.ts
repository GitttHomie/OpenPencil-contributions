import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { resetHugConstraintSize } from './apply'
import { invalidateDerivedLayouts } from './derived'
import { LAYOUT_INPUT_FIELDS } from './inputs'

interface PendingLayoutEdits {
  nodes: Set<string>
  created: Set<string>
  restored: Set<string>
  flushing: boolean
}

const pendingByGraph = new WeakMap<SceneGraph, PendingLayoutEdits>()

/** One recorder per graph, shared by editor, preview, scripting and layout entrypoints. */
export function trackLayoutEdits(graph: SceneGraph): void {
  if (pendingByGraph.has(graph)) return
  const pending: PendingLayoutEdits = {
    nodes: new Set(),
    created: new Set(),
    restored: new Set(),
    flushing: false
  }
  pendingByGraph.set(graph, pending)
  const recordsEdits = () =>
    !pending.flushing &&
    !graph.isApplyingLayout &&
    !graph.isApplyingImportedState &&
    !graph.isApplyingDerivedLayout &&
    !graph.isPreservingSourceMetadata
  function update(id: string, changes: Partial<SceneNode>) {
    if (!graph.isApplyingLayout && ('width' in changes || 'height' in changes)) {
      const node = graph.getNode(id)
      if (node) resetHugConstraintSize(node)
    }
    if (!recordsEdits() || !Object.keys(changes).some((key) => LAYOUT_INPUT_FIELDS.has(key))) return
    // History and import helpers can supply authoritative bounds explicitly.
    if (changes.derivedLayout) {
      pending.restored.add(id)
      return
    }
    pending.restored.delete(id)
    pending.nodes.add(id)
    // Excluding a layer changes the tree it just left as well as its own layout.
    const parentId = graph.getNode(id)?.parentId
    if ('layoutPositioning' in changes && parentId) pending.nodes.add(parentId)
  }
  graph.onNodeEvents({
    updated: update,
    previewUpdated: update,
    created: (node) => {
      if (!recordsEdits()) return
      pending.created.add(node.id)
      if (node.parentId) pending.nodes.add(node.parentId)
    },
    deleted: (_id, parentId) => {
      if (recordsEdits() && parentId) pending.nodes.add(parentId)
    },
    reparented: (id, before, after) => {
      if (!recordsEdits()) return
      pending.nodes.add(id)
      if (before) pending.nodes.add(before)
      pending.nodes.add(after)
    },
    reordered: (id, parentId) => {
      if (!recordsEdits()) return
      pending.nodes.add(id)
      pending.nodes.add(parentId)
    }
  })
}

/** Release saved bounds once per connected tree before deriving the edit's new geometry. */
export function invalidatePendingLayouts(graph: SceneGraph): void {
  trackLayoutEdits(graph)
  const pending = pendingByGraph.get(graph)
  if (!pending || pending.flushing || graph.isApplyingLayout || graph.isApplyingDerivedLayout)
    return
  pending.flushing = true
  try {
    invalidateDerivedLayouts(
      graph,
      pending.nodes,
      new Set([...pending.created, ...pending.restored])
    )
    pending.nodes.clear()
    pending.created.clear()
    pending.restored.clear()
  } finally {
    pending.flushing = false
  }
}
