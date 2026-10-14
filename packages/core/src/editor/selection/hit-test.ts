import type { SceneNode } from '@open-pencil/scene-graph'

import { LAYER_HIT_PAD } from '#core/constants'
import type { EditorContext } from '#core/editor/types'

export function createSelectionHitTestActions(
  ctx: EditorContext,
  select: (ids: string[], additive?: boolean) => void,
  clearSelection: () => void
) {
  function hitTestAtPoint(cx: number, cy: number, deep = false): SceneNode | null {
    const renderer = ctx.getRenderer()
    if (!renderer) return null
    const pad = LAYER_HIT_PAD / ctx.state.zoom
    const scopeId = ctx.state.enteredContainerId
    if (scopeId) {
      const scopeNode = ctx.graph.getNode(scopeId)
      if (!scopeNode) {
        ctx.state.enteredContainerId = null
      } else {
        return deep
          ? ctx.graph.hitTestDeep(cx, cy, scopeId, pad)
          : ctx.graph.hitTest(cx, cy, scopeId)
      }
    }
    return deep
      ? ctx.graph.hitTestDeep(cx, cy, ctx.state.currentPageId, pad)
      : ctx.graph.hitTest(cx, cy, ctx.state.currentPageId)
  }

  /**
   * Selects what a right-click is over, as Figma does: the layer a click would select, or else the
   * frame or section whose empty area is under the point, which a click leaves for a marquee.
   */
  function selectAtPoint(cx: number, cy: number) {
    const scopeId = ctx.state.enteredContainerId ?? ctx.state.currentPageId
    const hit = hitTestAtPoint(cx, cy) ?? ctx.graph.hitTestOpenContainer(cx, cy, scopeId)
    if (hit) {
      if (!ctx.state.selectedIds.has(hit.id)) select([hit.id])
    } else {
      clearSelection()
    }
  }

  return { hitTestAtPoint, selectAtPoint }
}
