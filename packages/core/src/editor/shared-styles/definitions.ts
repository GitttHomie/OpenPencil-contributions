import type { SceneNode, SharedStyleType } from '@open-pencil/scene-graph'

import type { EditorContext } from '#core/editor/types'

/** Style records are resources, never visible layout content. */
export function addStyleDefinition(
  ctx: EditorContext,
  kind: SharedStyleType,
  fields: Partial<SceneNode>
): SceneNode {
  const node = ctx.graph.createNode(
    kind === 'TEXT' ? 'TEXT' : 'RECTANGLE',
    ctx.state.currentPageId,
    {
      ...fields,
      width: 0,
      height: 0,
      text: '',
      internalOnly: true,
      sharedStyleType: kind
    }
  )
  ctx.graph.updateNode(node.id, {
    source: { ...node.source, id: crypto.randomUUID() }
  })
  const snapshot = structuredClone(node)
  const parentId = node.parentId
  ctx.undo.push({
    label: 'Create style',
    forward: () => {
      ctx.graph.createNodeWithId(snapshot.id, snapshot.type, parentId, structuredClone(snapshot))
      ctx.requestRender()
    },
    inverse: () => {
      ctx.graph.deleteNode(snapshot.id)
      ctx.requestRender()
    }
  })
  return node
}
