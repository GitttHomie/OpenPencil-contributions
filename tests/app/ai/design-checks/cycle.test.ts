import 'fake-indexeddb/auto'
import { expect, spyOn, test } from 'bun:test'

import { createDesignCheckCycle } from '@/app/ai/design-checks/cycle'
import { designCheckState } from '@/app/ai/design-checks/state'
import { startRun } from '@/app/ai/tools/run'
import { createEditorStore } from '@/app/editor/session/create'

test('reviews changed roots on their own page and invalidates the check after later edits', async () => {
  const store = createEditorStore()
  store.preparationController.acknowledgePresentation(Number.MAX_SAFE_INTEGER)
  const pageId = store.state.currentPageId
  const frame = store.graph.createNode('FRAME', pageId, { name: 'Card', width: 320, height: 240 })
  const unrelatedPage = store.graph.addPage('Other page')
  const state = designCheckState(store)
  state.supportsImages = true
  const cycle = createDesignCheckCycle(store)
  const image = spyOn(store, 'renderExportImage').mockResolvedValue(new Uint8Array([1, 2]))
  try {
    expect(cycle.changed()).toBe(false)
    store.graph.updateNode(frame.id, { width: 400 })
    await store.switchPage(unrelatedPage.id)
    expect(cycle.changed()).toBe(true)
    const message = await cycle.prepare(true)
    expect(message.parts.filter((part) => part.type === 'file')).toHaveLength(1)
    expect(image).toHaveBeenCalledWith([frame.id], 1, 'PNG', pageId)
    expect(store.state.currentPageId).toBe(unrelatedPage.id)
    expect(cycle.reviewed()).toBe(true)
    expect(state.status.value).toBe('reviewed')
    store.graph.updateNode(frame.id, { width: 440 })
    expect(cycle.reviewed()).toBe(false)
    expect(state.status.value).toBe('stale')
    await cycle.prepare(false)
    expect(cycle.reviewed()).toBe(true)
    cycle.finish()
    store.graph.updateNode(frame.id, { height: 260 })
    expect(state.status.value).toBe('stale')
  } finally {
    cycle.finish()
    image.mockRestore()
    store.dispose()
  }
})

test('automatic checks do not restart an exhausted model step budget', () => {
  const store = createEditorStore()
  const run = startRun(store, 1)
  const cycle = createDesignCheckCycle(store)
  try {
    store.graph.createNode('FRAME', store.state.currentPageId, { width: 100, height: 100 })
    run.currentSteps = 1
    expect(cycle.changed()).toBe(false)
    expect(designCheckState(store).status.value).toBe('stale')
  } finally {
    cycle.finish()
    store.dispose()
  }
})
