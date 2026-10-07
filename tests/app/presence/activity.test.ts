import 'fake-indexeddb/auto'
import { expect, test } from 'bun:test'

import { endRun, startRun } from '@/app/ai/tools/run'
import { createEditorStore } from '@/app/editor/session/create'
import { thinkingCursor } from '@/app/presence/activity'

test('a new chat run is visible in the active viewport before any canvas tool runs', () => {
  const store = createEditorStore()
  try {
    store.resizePane(store.activePaneId.value, 800, 600)
    store.state.panX = -1000
    store.state.panY = 40
    store.state.zoom = 2
    expect(thinkingCursor(store)).toEqual({ x: 700, y: 130, pageId: store.state.currentPageId })
    startRun(store, 10, 'test-model')
    expect(store.state.presenceCursors).toMatchObject([{ kind: 'agent', x: 700, y: 130 }])
    endRun(store)
    expect(store.state.presenceCursors).toEqual([])
  } finally {
    store.dispose()
  }
})
