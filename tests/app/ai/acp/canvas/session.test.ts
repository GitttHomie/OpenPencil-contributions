import 'fake-indexeddb/auto'
import { afterEach, expect, test } from 'bun:test'

import { TOOL_CHANGE_ID_FIELD } from '@open-pencil/core/constants'
import { FigmaAPI } from '@open-pencil/core/figma-api'

import { createACPCanvasActivity } from '@/app/ai/acp/canvas/activity'
import { createCanvasSession } from '@/app/ai/acp/canvas/session'
import { changePreviewSize } from '@/app/ai/chat/preferences'
import { recordTurn, revertTurn, turnEdits, clearTurns } from '@/app/ai/chat/turns'
import { readToolChange, clearToolChanges } from '@/app/ai/tools/changes/store'
import { resetRunTracking, runUndoEntries } from '@/app/ai/tools/run'
import { createAutomationToolHandler } from '@/app/automation/bridge/tool-handlers'
import { createEditorStore } from '@/app/editor/session/create'

const previousSize = changePreviewSize.value
changePreviewSize.value = 'off'
afterEach(() => {
  clearTurns()
  clearToolChanges()
  changePreviewSize.value = previousSize
})

test('CLI canvas edits have before/after previews, run baselines and guarded turn undo', async () => {
  changePreviewSize.value = 'off'
  const store = createEditorStore()
  const session = createCanvasSession(store)
  const activity = createACPCanvasActivity(store, 'Codex')
  const node = store.graph.createNode('FRAME', store.state.currentPageId, {
    width: 100,
    height: 60
  })
  const target = {
    store,
    pageId: store.state.currentPageId,
    pageName: 'Page 1',
    documentId: 'doc',
    documentName: 'Test'
  }
  const handle = createAutomationToolHandler((editor, pageId) => {
    const figma = new FigmaAPI(editor.graph)
    figma.currentPage = figma.wrapNode(pageId ?? editor.state.currentPageId)
    return figma
  })
  try {
    resetRunTracking(store)
    session.start()
    activity.start()
    const response = await handle(
      target,
      { name: 'node_resize', args: { id: node.id, width: 200, height: 60 } },
      session.id
    )
    expect(response).toHaveProperty('result')
    const result = (response as { result: Record<string, unknown> }).result
    const changeId = result[TOOL_CHANGE_ID_FIELD]
    expect(typeof changeId).toBe('string')
    activity.update({
      sessionUpdate: 'tool_call',
      toolCallId: 'cli-call',
      title: 'mcp.open-pencil.node_resize',
      status: 'completed',
      rawOutput: { result }
    })
    const change = readToolChange('cli-call')
    expect(change?.toolCallId).toBe('cli-call')
    expect(change?.jsx.before).toContain('100')
    expect(change?.jsx.after).toContain('200')
    expect(runUndoEntries(store)).toHaveLength(1)
    const baseline = await handle(
      target,
      { name: 'diff_changes', args: { id: node.id } },
      session.id
    )
    expect(JSON.stringify(baseline)).toContain('200')
    recordTurn('reply', store, runUndoEntries(store))
    expect(turnEdits('reply')?.revertable).toBe(true)
    store.pushUndoEntry({
      label: 'User edit',
      forward() {
        store.graph.updateNode(node.id, { name: 'User name' })
      },
      inverse() {
        store.graph.updateNode(node.id, { name: node.name })
      }
    })
    expect(revertTurn('reply')).toBe(false)
    store.undoAction()
    expect(revertTurn('reply')).toBe(true)
    expect(store.graph.getNode(node.id)?.width).toBe(100)
    resetRunTracking(store)
    session.finish()
    await handle(
      target,
      { name: 'node_resize', args: { id: node.id, width: 300, height: 60 } },
      'unrelated-session'
    )
    expect(runUndoEntries(store)).toHaveLength(0)
  } finally {
    session.dispose()
    activity.dispose()
    store.dispose()
  }
})

test('unrelated MCP sessions never acquire ownership of a chat turn', async () => {
  const store = createEditorStore()
  const session = createCanvasSession(store)
  const target = {
    store,
    pageId: store.state.currentPageId,
    pageName: 'Page 1',
    documentId: 'doc',
    documentName: 'Test'
  }
  const handle = createAutomationToolHandler((editor) => new FigmaAPI(editor.graph))
  const node = store.graph.createNode('FRAME', store.state.currentPageId, { width: 100 })
  try {
    resetRunTracking(store)
    session.start()
    await handle(target, { name: 'node_resize', args: { id: node.id, width: 200, height: 60 } })
    expect(runUndoEntries(store)).toHaveLength(0)
    await handle(
      target,
      { name: 'node_resize', args: { id: node.id, width: 200, height: 60 } },
      'unrelated-session'
    )
    expect(runUndoEntries(store)).toHaveLength(0)
  } finally {
    session.dispose()
    store.dispose()
  }
})

test('a managed structural edit records exactly one undo step', async () => {
  changePreviewSize.value = 'off'
  const store = createEditorStore()
  const session = createCanvasSession(store)
  const handle = createAutomationToolHandler((editor) => new FigmaAPI(editor.graph))
  const previous = store.undo.peekUndo()
  try {
    resetRunTracking(store)
    session.start()
    await handle(
      {
        store,
        pageId: store.state.currentPageId,
        pageName: 'Page',
        documentId: 'test',
        documentName: 'Test'
      },
      {
        name: 'create_shape',
        args: { type: 'RECTANGLE', name: 'Managed shape', x: 0, y: 0, width: 40, height: 40 }
      },
      session.id
    )
    expect(runUndoEntries(store)).toHaveLength(1)
    expect(store.graph.getChildren(store.state.currentPageId)).toHaveLength(1)
    store.undoAction()
    expect(store.graph.getChildren(store.state.currentPageId)).toHaveLength(0)
    expect(store.undo.peekUndo()).toBe(previous)
    store.redoAction()
    expect(store.graph.getChildren(store.state.currentPageId)).toHaveLength(1)
  } finally {
    session.dispose()
    store.dispose()
  }
})
