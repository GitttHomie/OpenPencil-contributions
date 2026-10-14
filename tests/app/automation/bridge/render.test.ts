import 'fake-indexeddb/auto'
import { expect, spyOn, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'

import { createAutomationToolHandler } from '@/app/automation/bridge/tool-handlers'
import { createEditorStore } from '@/app/editor/session/create'

test('MCP JSX renders preserve replacement placement and return design feedback', async () => {
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
          jsx: '<Frame name="Replacement" flex="col" p={16}><Frame flex="col" p={16}><Rectangle w={20} h={20}/></Frame></Frame>'
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

test('a first raw JSX render updates instances and keeps one undo step', async () => {
  const store = createEditorStore()
  const pageId = store.state.currentPageId
  const component = store.graph.createNode('COMPONENT', pageId, {
    layoutMode: 'VERTICAL',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'FIXED',
    width: 120
  })
  const instance = store.graph.createInstance(component.id, pageId)
  if (!instance) throw new Error('Instance unavailable')
  await Promise.resolve()
  const before = store.snapshotPage(pageId)
  const sync = spyOn(store.graph, 'syncInstancesTogether')
  const handle = createAutomationToolHandler((editor) => new FigmaAPI(editor.graph))
  const jsx = '<><Frame name="A" w={120} h={20}/><Frame name="B" w={120} h={30}/></>'

  try {
    const previousUndo = store.undo.peekUndo()
    const result = await handle(
      { store, documentId: 'test', documentName: 'Test', pageId, pageName: 'Page' },
      { name: 'render', args: { jsx, parent_id: component.id } }
    )
    expect(result).toMatchObject({ ok: true })
    expect(sync).toHaveBeenCalledTimes(1)
    expect(store.graph.getChildren(instance.id).map((node) => node.name)).toEqual(['A', 'B'])
    expect(instance.height).toBe(50)
    store.undoAction()
    await Promise.resolve()
    expect(store.snapshotPage(pageId)).toEqual(before)
    expect(store.undo.peekUndo()).toBe(previousUndo)
    store.redoAction()
    await Promise.resolve()
    expect(store.graph.getChildren(instance.id).map((node) => node.name)).toEqual(['A', 'B'])
    expect(store.graph.getNode(instance.id)?.height).toBe(50)
  } finally {
    sync.mockRestore()
    store.dispose()
  }
})
