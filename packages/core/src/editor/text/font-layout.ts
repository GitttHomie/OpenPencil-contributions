import type { SkiaRenderer } from '#core/canvas/renderer'
import type { EditorContext } from '#core/editor/types'
import { withTextMeasurer } from '#core/layout/text-measurement'
import { collectNodeFontFaces } from '#core/text/requirements'
import type { FontResolutionSnapshot } from '#core/text/resolver'

type FontLayoutContext = Pick<EditorContext, 'graph' | 'runLayoutForNode' | 'requestRender'> & {
  getRenderer: () => Pick<SkiaRenderer, 'measureTextNode'> | null
}

/** Replace provisional font measurements without adding an edit to the undo history. */
export function refreshTextLayoutForFont(ctx: FontLayoutContext, snapshot: FontResolutionSnapshot) {
  const renderer = ctx.getRenderer()
  const candidate = snapshot.candidate
  if (!renderer || snapshot.state !== 'loaded' || !candidate) return
  const changed: string[] = []
  const graph = ctx.graph
  graph.withLayoutMutations(() => {
    for (const node of graph.getAllNodes()) {
      if (
        node.type !== 'TEXT' ||
        (node.textAutoResize !== 'HEIGHT' && node.textAutoResize !== 'WIDTH_AND_HEIGHT') ||
        node.textPathData ||
        node.derivedTextGlyphs?.length ||
        node.derivedLayout
      )
        continue
      if (
        candidate.source !== 'fallback' &&
        !collectNodeFontFaces(node).some(
          ({ family, style }) =>
            family.toLocaleLowerCase() === candidate.family.toLocaleLowerCase() &&
            style.toLocaleLowerCase() === candidate.style.toLocaleLowerCase()
        )
      )
        continue
      const measured = renderer.measureTextNode(
        node,
        node.textAutoResize === 'HEIGHT' ? node.width : undefined
      )
      if (!measured) continue
      const width = node.textAutoResize === 'WIDTH_AND_HEIGHT' ? measured.width : node.width
      if (width === node.width && measured.height === node.height) continue
      graph.updateNode(node.id, { width, height: measured.height })
      changed.push(node.id)
    }
    withTextMeasurer(
      (node, maxWidth) => renderer.measureTextNode(node, maxWidth),
      () => {
        for (const id of changed) ctx.runLayoutForNode(id)
      }
    )
  })
  if (changed.length > 0) ctx.requestRender()
}
