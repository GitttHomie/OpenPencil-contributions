import 'fake-indexeddb/auto'
import { expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'

import { designCheckState } from '@/app/ai/design-checks/state'
import { createAutomationToolHandler } from '@/app/automation/bridge/tool-handlers'
import { createEditorStore } from '@/app/editor/session/create'

test('a report-only managed CLI pass cannot edit through the canvas bridge', async () => {
  const store = createEditorStore()
  const pageId = store.state.currentPageId
  const handle = createAutomationToolHandler((editor) => new FigmaAPI(editor.graph))
  designCheckState(store).readOnly = true
  try {
    const count = store.graph.getChildren(pageId).length
    const response = await handle(
      {
        store,
        pageId,
        pageName: 'Page',
        documentId: 'tab-1',
        documentName: 'Document'
      },
      {
        name: 'create_shape',
        args: { type: 'RECTANGLE', width: 100, height: 100 }
      },
      'managed-review'
    )
    expect(response).toMatchObject({
      ok: true,
      result: { error: expect.stringContaining('read-only') }
    })
    expect(store.graph.getChildren(pageId)).toHaveLength(count)
  } finally {
    store.dispose()
  }
})
