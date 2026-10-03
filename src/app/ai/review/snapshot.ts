import type { SceneNode } from '@open-pencil/scene-graph'

import type { EditorStore } from '@/app/editor/active-store'

const MAX_NODES = 300
const MAX_TEXT = 1000

function reviewNode(node: SceneNode) {
  return {
    id: node.id,
    parentId: node.parentId,
    name: node.name,
    type: node.type,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    text: node.text.slice(0, MAX_TEXT),
    fontFamily: node.fontFamily,
    fontSize: node.fontSize,
    layoutMode: node.layoutMode,
    itemSpacing: node.itemSpacing,
    padding: [node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft],
    componentId: node.componentId,
    boundVariables: node.boundVariables
  }
}

export function captureReviewSnapshot(store: EditorStore) {
  const pageId = store.state.currentPageId
  const selected = [...store.state.selectedIds]
  const roots = selected.length ? selected : store.graph.getChildren(pageId).map((node) => node.id)
  const rootIds = roots.filter((id) => store.graph.getNode(id)?.visible)
  const pending = [...rootIds]
  const seen = new Set<string>()
  const nodes: ReturnType<typeof reviewNode>[] = []
  while (pending.length && nodes.length < MAX_NODES) {
    const id = pending.shift()
    if (!id || seen.has(id)) continue
    seen.add(id)
    const node = store.graph.getNode(id)
    if (!node?.visible) continue
    nodes.push(reviewNode(node))
    pending.push(...node.childIds)
  }
  return {
    pageId,
    rootIds,
    count: nodes.length,
    text: JSON.stringify({
      scope: selected.length ? 'selection' : 'current page',
      truncated: pending.length > 0,
      nodes
    })
  }
}
