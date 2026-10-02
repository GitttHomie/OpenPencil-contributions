import type { LayoutMode, SceneNode } from '@open-pencil/scene-graph'
import { getAxisAlignedBoundsInParent } from '@open-pencil/scene-graph/coordinate'

import { assertNodeEditable } from '#core/editor/capabilities'
import { applyMoveStates, captureMoveState } from '#core/editor/history/move'
import type { NodePreview } from '#core/editor/node-preview'
import type { EditorContext } from '#core/editor/types'

export function wrapInAutoLayout(
  ctx: EditorContext,
  selectedNodes: SceneNode[],
  beginNodePreview: (label: string) => NodePreview
) {
  if (selectedNodes.length === 0) return

  const parentId = selectedNodes[0].parentId ?? ctx.state.currentPageId
  if (!selectedNodes.every((node) => (node.parentId ?? ctx.state.currentPageId) === parentId))
    return
  const parent = ctx.graph.getNode(parentId)
  if (!parent) return
  assertNodeEditable(ctx.graph, parentId)
  for (const node of selectedNodes) assertNodeEditable(ctx.graph, node.id)

  const prevSelection = new Set(ctx.state.selectedIds)
  const originals = new Map(
    selectedNodes.map((node) => [node.id, captureMoveState(ctx.graph, node)])
  )
  const firstIndex = Math.min(...selectedNodes.map((node) => parent.childIds.indexOf(node.id)))
  const bounds = getAxisAlignedBoundsInParent(selectedNodes, parentId, ctx.graph)
  const direction: LayoutMode =
    selectedNodes.length <= 1 || bounds.height > bounds.width ? 'VERTICAL' : 'HORIZONTAL'
  const sortedIds = selectedNodes
    .map((node) => ({ id: node.id, pos: ctx.graph.getAbsolutePosition(node.id) }))
    .sort((a, b) => a.pos.y - b.pos.y || a.pos.x - b.pos.x)
    .map((node) => node.id)

  ctx.undo.runBatch('Wrap in auto layout', () => {
    const frame = ctx.graph.createNode('FRAME', parentId, {
      name: 'Frame',
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      layoutMode: direction,
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG',
      primaryAxisAlign: 'MIN',
      counterAxisAlign: 'MIN',
      fills: []
    })
    const frameId = frame.id
    // The redo template must not retain the live frame's mutated child list or dimensions.
    const template = structuredClone(frame)
    function attachChildren() {
      ctx.graph.insertChildAt(frameId, parentId, firstIndex)
      for (const id of sortedIds) ctx.graph.reparentNode(id, frameId)
    }
    attachChildren()
    ctx.undo.push({
      label: 'Wrap selection',
      forward: () => {
        ctx.graph.createNode('FRAME', parentId, structuredClone(template))
        attachChildren()
        ctx.setSelectedIds(new Set([frameId]))
      },
      inverse: () => {
        // The layout entry restores geometry first; do not recalculate it while unwrapping.
        applyMoveStates(ctx, originals, { runLayout: false })
        ctx.graph.deleteNode(frameId)
        ctx.setSelectedIds(new Set(prevSelection))
      }
    })
    const layout = beginNodePreview('Layout wrapped selection')
    layout.update(frameId, { layoutMode: direction })
    layout.commit()
    ctx.setSelectedIds(new Set([frameId]))
  })
}
