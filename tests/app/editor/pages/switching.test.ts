import { expect, test } from 'bun:test'

import { createEditorStore } from '@/app/editor/session/create'

test('a superseded page switch resolves quietly and the latest page wins', async () => {
  const editor = createEditorStore()
  const stopPresenting = editor.onPreparationEvent('preparation:updated', (preparation) => {
    if (preparation.phase === 'preparing-render') {
      editor.preparationController.acknowledgePresentation(editor.state.sceneVersion)
    }
  })
  try {
    const first = editor.graph.addPage('First')
    const second = editor.graph.addPage('Second')
    await Promise.all([editor.switchPage(first.id), editor.switchPage(second.id)])
    expect(editor.state.currentPageId).toBe(second.id)
    expect(editor.state.preparation).toBeNull()
  } finally {
    stopPresenting()
    editor.dispose()
  }
})

test('an explicitly supplied preparation still propagates cancellation to its caller', async () => {
  const editor = createEditorStore()
  try {
    const page = editor.graph.addPage('Target')
    const preparation = editor.preparationController.begin({ kind: 'page-switch' })
    const switching = editor.switchPage(page.id, { preparation })
    preparation.cancel()
    await expect(switching).rejects.toThrow()
  } finally {
    editor.dispose()
  }
})
