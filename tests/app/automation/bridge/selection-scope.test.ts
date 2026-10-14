import { expect, test } from 'bun:test'

import { limitToSelection } from '@/app/automation/bridge/selection-scope'
import { createEditorStore } from '@/app/editor/session/create'

test('selection-only inspection checks every shared or per-item batch target', () => {
  const store = createEditorStore()
  const graph = store.graph
  const selected = graph.createNode('FRAME', store.state.currentPageId)
  const child = graph.createNode('TEXT', selected.id)
  const outside = graph.createNode('FRAME', store.state.currentPageId)
  store.select([selected.id])
  try {
    for (const args of [
      { ids: [selected.id, child.id], depth: 0 },
      { items: [{ id: selected.id }, { id: child.id, depth: 1 }] }
    ])
      expect(limitToSelection(store, 'get_node', args)).toEqual(args)
    for (const args of [
      { ids: [child.id, outside.id] },
      { items: [{ id: child.id }, { id: outside.id }] },
      { items: [{ id: child.id, path: 'out.json' }] },
      { items: [{ depth: 0 }] },
      { id: child.id, items: [{ id: outside.id }] },
      { items: [{ id: child.id, items: [{ id: outside.id }] }] }
    ])
      expect(() => limitToSelection(store, 'get_node', args)).toThrow()
  } finally {
    store.dispose()
  }
})
