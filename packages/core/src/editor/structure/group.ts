import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { getNodeEditCapability } from '#core/editor/capabilities'
import { prepareSlotEdits } from '#core/editor/components/slots/index'
import type { EditorContext } from '#core/editor/types'

/**
 * Moves a container's children into its parent, in the container's place in the stack, and
 * deletes the container. Returns the children, or null when the container has no parent. Shared
 * by the editor's Ungroup command and the plugin API's `ungroup`.
 */
export function ungroupNode(graph: SceneGraph, nodeId: string): string[] | null {
  const node = graph.getNode(nodeId)
  const parent = node?.parentId ? graph.getNode(node.parentId) : undefined
  if (!node || !parent) return null
  const index = parent.childIds.indexOf(node.id)
  const childIds = [...node.childIds]
  childIds.forEach((id, i) => {
    graph.reparentNode(id, parent.id)
    graph.insertChildAt(id, parent.id, index + i)
  })
  graph.deleteNode(node.id)
  return childIds
}

export function ungroupSelected(ctx: EditorContext, selectedNode: SceneNode | undefined) {
  if (!selectedNode || !['GROUP', 'FRAME'].includes(selectedNode.type)) return
  if (selectedNode.locked || !getNodeEditCapability(ctx.graph, selectedNode.id).editable) return
  const label = selectedNode.type === 'FRAME' ? 'Remove frame' : 'Ungroup'
  ctx.undo.runBatch(label, () => {
    if (!selectedNode.parentId || !prepareSlotEdits(ctx, [selectedNode.id, selectedNode.parentId]))
      return
    releaseContainer(ctx, selectedNode, label)
  })
}

function releaseContainer(ctx: EditorContext, node: SceneNode, label: string) {
  const parentId = node.parentId ?? ctx.state.currentPageId
  const parent = ctx.graph.getNode(parentId)
  if (!parent) return

  const groupIndex = parent.childIds.indexOf(node.id)
  const prevSelection = new Set(ctx.state.selectedIds)
  const origPositions = node.childIds.flatMap((id) => {
    const child = ctx.graph.getNode(id)
    if (!child) return []
    return [
      {
        id,
        x: child.x,
        y: child.y,
        width: child.width,
        height: child.height,
        rotation: child.rotation,
        flipX: child.flipX,
        flipY: child.flipY
      }
    ]
  })
  const groupId = node.id
  const groupSnapshot = structuredClone(node)

  const ungroup = () => {
    const childIds = ungroupNode(ctx.graph, groupId)
    if (childIds) ctx.setSelectedIds(new Set(childIds))
    ctx.runLayoutForNode(parentId)
    ctx.requestRender()
  }
  ungroup()

  ctx.undo.push({
    label,
    forward: ungroup,
    inverse: () => {
      const g = ctx.graph.createNode(groupSnapshot.type, parentId, {
        ...groupSnapshot,
        childIds: [],
        id: groupId
      })
      ctx.graph.insertChildAt(g.id, parentId, groupIndex)
      for (const orig of origPositions) {
        ctx.graph.reparentNode(orig.id, g.id)
        const { id, ...transform } = orig
        ctx.graph.updateNode(id, transform)
      }
      ctx.runLayoutForNode(g.id)
      ctx.requestRender()
      ctx.setSelectedIds(prevSelection)
    }
  })
}
