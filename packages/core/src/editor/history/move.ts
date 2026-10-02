import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import type { EditorContext } from '#core/editor/types'

export type MoveState = Pick<SceneNode, 'x' | 'y'> & {
  parentId: string
  index?: number
} & Partial<
    Pick<
      SceneNode,
      | 'rotation'
      | 'flipX'
      | 'flipY'
      | 'width'
      | 'height'
      | 'layoutPositioning'
      | 'primaryAxisSizing'
      | 'counterAxisSizing'
    >
  >

export function captureMoveState(graph: SceneGraph, node: SceneNode): MoveState {
  return {
    x: node.x,
    y: node.y,
    parentId: node.parentId ?? graph.rootId,
    index: node.parentId ? graph.getNode(node.parentId)?.childIds.indexOf(node.id) : undefined,
    rotation: node.rotation,
    flipX: node.flipX,
    flipY: node.flipY,
    width: node.width,
    height: node.height,
    layoutPositioning: node.layoutPositioning,
    primaryAxisSizing: node.primaryAxisSizing,
    counterAxisSizing: node.counterAxisSizing
  }
}

export function applyMoveStates(
  ctx: EditorContext,
  states: ReadonlyMap<string, MoveState>,
  options: { runLayout?: boolean } = {}
) {
  const parents = new Set<string>()
  for (const [id, state] of states) {
    const oldParent = ctx.graph.getNode(id)?.parentId
    if (oldParent) parents.add(oldParent)
    parents.add(state.parentId)
    ctx.graph.reparentNode(id, state.parentId)
    const { parentId: _parentId, index: _index, ...properties } = state
    ctx.graph.updateNode(id, properties)
  }
  // Remove the whole moving block before restoring indices, so one item cannot shift another.
  for (const parentId of parents) {
    const entries = [...states]
      .filter(([, state]) => state.parentId === parentId && state.index !== undefined)
      .sort((a, b) => (a[1].index ?? 0) - (b[1].index ?? 0))
    const moving = new Set(entries.map(([id]) => id))
    const order = ctx.graph.getNode(parentId)?.childIds.filter((id) => !moving.has(id)) ?? []
    for (const [id, state] of entries) order.splice(state.index ?? order.length, 0, id)
    const parent = ctx.graph.getNode(parentId)
    order.forEach((id, index) => {
      if (parent?.childIds[index] !== id) ctx.graph.reorderChild(id, parentId, index)
    })
  }
  if (options.runLayout !== false) {
    for (const parentId of parents) ctx.runLayoutForNode(parentId)
  }
}
