import type { EditorContext } from '#core/editor/types'
import { sizeAutoResizingText } from '#core/layout/text-auto-resize'
import { collectNodeFontFaces } from '#core/text/requirements'

/** Variable changes use the same host font loader as ordinary font selection. */
export function loadBoundFonts(ctx: EditorContext, ids: readonly string[]): void {
  const graph = ctx.graph
  const texts = ids.flatMap((id) => {
    const node = graph.getNode(id)
    return node?.type === 'TEXT' ? [node] : []
  })
  if (!texts.length) return
  void Promise.allSettled(
    texts.flatMap((node) =>
      collectNodeFontFaces(node).map((face) => ctx.loadFont(face.family, face.style, node.text))
    )
  ).then(() => {
    if (ctx.graph !== graph) return undefined
    for (const node of texts) {
      if (!graph.getNode(node.id)) continue
      sizeAutoResizingText(graph, node.id)
      ctx.runLayoutForNode(node.id)
    }
    ctx.requestRender()
    return undefined
  })
}
