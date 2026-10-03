import 'fake-indexeddb/auto'
import { expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { Frame, Rectangle } from '@open-pencil/design-jsx'

import { createAutomationToolHandler } from '@/app/automation/bridge/tool-handlers'
import { createEditorStore } from '@/app/editor/session/create'

test('pre-parsed MCP renders preserve replacement placement and return design feedback', async () => {
  const store = createEditorStore()
  try {
    const pageId = store.state.currentPageId
    const old = store.graph.createNode('FRAME', pageId, { x: 700, y: 300 })
    const handle = createAutomationToolHandler((editor, targetPageId) => {
      const figma = new FigmaAPI(editor.graph)
      figma.currentPage = figma.wrapNode(targetPageId ?? pageId)
      return figma
    })
    const result = await handle(
      { store, documentId: 'test', documentName: 'Test', pageId, pageName: 'Page' },
      {
        name: 'render',
        args: {
          replace_id: old.id,
          tree: Frame({
            name: 'Replacement',
            flex: 'col',
            p: 16,
            children: Frame({
              flex: 'col',
              p: 16,
              children: Rectangle({ w: 20, h: 20 })
            })
          })
        }
      }
    )
    expect(result).toMatchObject({
      ok: true,
      result: { designFeedback: [{ code: 'unbound-spacing' }] }
    })
    expect(store.graph.getNode(old.id)).toBeUndefined()
    const replacement = [...store.graph.getAllNodes()].find((node) => node.name === 'Replacement')
    expect(replacement).toMatchObject({ x: 700, y: 300 })
  } finally {
    store.dispose()
  }
})
