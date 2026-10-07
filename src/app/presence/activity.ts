import type { EditorStore } from '@/app/editor/active-store'

import type { PresencePoint } from './types'

const INITIAL_CURSOR_OFFSET = 64

/** Show a thinking agent on the visible canvas before any tool has produced nodes. */
export function thinkingCursor(store: EditorStore): PresencePoint {
  const { viewportWidth, viewportHeight } = store.panes.getActivePane()
  const { panX, panY, zoom, currentPageId } = store.state
  return {
    x: ((viewportWidth > 0 ? viewportWidth / 2 : INITIAL_CURSOR_OFFSET) - panX) / zoom,
    y: ((viewportHeight > 0 ? viewportHeight / 2 : INITIAL_CURSOR_OFFSET) - panY) / zoom,
    pageId: currentPageId
  }
}
