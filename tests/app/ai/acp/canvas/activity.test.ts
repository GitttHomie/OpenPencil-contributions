import 'fake-indexeddb/auto'
import { expect, test } from 'bun:test'

import { canvasResultNodeIds, createACPCanvasActivity } from '@/app/ai/acp/canvas/activity'
import { createEditorStore } from '@/app/editor/session/create'
import { presenceOf } from '@/app/presence/registry'

test('reads MCP envelopes, excludes failed outputs, and bounds nested results', () => {
  expect(
    canvasResultNodeIds({
      result: { content: [{ type: 'text', text: '{"id":"card","siblings":[{"id":"badge"}]}' }] },
      error: null
    })
  ).toEqual(['card', 'badge'])
  expect(canvasResultNodeIds({ isError: true, id: 'card' })).toEqual([])
  expect(canvasResultNodeIds({ text: 'random prose card', args: { id: 'card' } })).toEqual([])
  expect(
    canvasResultNodeIds(Array.from({ length: 1000 }, (_, i) => ({ id: `${i}` })).slice())
  ).toHaveLength(511)
})

test('the agent starts visible and only recognized canvas tools move it to nodes', () => {
  const store = createEditorStore()
  const activity = createACPCanvasActivity(store, 'test-model')
  try {
    const node = store.graph.createNode('FRAME', store.state.currentPageId, { x: 200, y: 80 })
    activity.start()
    expect(store.state.presenceCursors).toHaveLength(1)
    const initialCursor = store.state.presenceCursors
    store.graph.updateNode(node.id, { x: 210 })
    expect(store.state.presenceCursors).toEqual(initialCursor)
    activity.update({
      sessionUpdate: 'tool_call',
      toolCallId: 'other',
      title: 'shell',
      status: 'completed',
      rawOutput: { id: node.id }
    })
    expect(store.state.presenceCursors).toEqual(initialCursor)
    activity.update({
      sessionUpdate: 'tool_call',
      toolCallId: 'canvas',
      title: '@open-pencil/set_fill',
      status: 'in_progress'
    })
    activity.update({
      sessionUpdate: 'tool_call_update',
      toolCallId: 'canvas',
      status: 'completed',
      rawOutput: { result: { id: node.id } }
    })
    expect(store.state.presenceCursors).toMatchObject([
      { kind: 'agent', x: 210, y: 80, selection: [node.id] }
    ])
    expect(presenceOf(store).agents.value[0]?.kind).toBe('acp')
    activity.finish()
    activity.update({
      sessionUpdate: 'tool_call',
      toolCallId: 'late',
      title: '@open-pencil/set_fill',
      status: 'completed',
      rawOutput: { id: node.id }
    })
    expect(store.state.presenceCursors).toHaveLength(0)
    expect(presenceOf(store).agents.value[0]?.status).toBe('idle')
    activity.dispose()
    expect(presenceOf(store).agents.value).toHaveLength(0)
  } finally {
    activity.dispose()
    store.dispose()
  }
})

test('uses Kiro tool IDs and retains content received before the completion event', () => {
  const store = createEditorStore()
  const activity = createACPCanvasActivity(store, 'kiro')
  try {
    const node = store.graph.createNode('FRAME', store.state.currentPageId, { x: 200, y: 80 })
    activity.start()
    activity.update({
      sessionUpdate: 'tool_call',
      toolCallId: 'render',
      title: 'Render',
      status: 'in_progress',
      rawInput: { tool_id: 'open-pencil::render', arguments: { jsx: '<Frame />' } },
      rawOutput: {},
      content: [
        { type: 'content', content: { type: 'text', text: JSON.stringify({ id: node.id }) } }
      ]
    })
    activity.update({
      sessionUpdate: 'tool_call_update',
      toolCallId: 'render',
      status: 'completed'
    })
    expect(store.state.presenceCursors).toMatchObject([{ x: 200, y: 80, selection: [node.id] }])
  } finally {
    activity.dispose()
    store.dispose()
  }
})

test('points at a Codex edit target while it runs and clears selection on failure', () => {
  const store = createEditorStore()
  const activity = createACPCanvasActivity(store, 'codex')
  try {
    const node = store.graph.createNode('FRAME', store.state.currentPageId, { x: 90, y: 120 })
    activity.start()
    activity.update({
      sessionUpdate: 'tool_call',
      toolCallId: 'edit',
      title: 'mcp.open-pencil.update_node',
      status: 'in_progress',
      rawInput: {
        server: 'open-pencil',
        tool: 'update_node',
        arguments: { id: node.id, width: 320 }
      }
    })
    expect(store.state.presenceCursors).toMatchObject([{ x: 90, y: 120, selection: [node.id] }])
    activity.update({ sessionUpdate: 'tool_call_update', toolCallId: 'edit', status: 'failed' })
    expect(store.state.presenceCursors[0]?.selection).toBeUndefined()
    expect(presenceOf(store).agents.value[0]?.status).toBe('thinking')
  } finally {
    activity.dispose()
    store.dispose()
  }
})
