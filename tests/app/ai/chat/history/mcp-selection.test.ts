import 'fake-indexeddb/auto'
import { expect, test } from 'bun:test'

import { createConversationHistory } from '@/app/ai/chat/history/controller'
import { createConversationStore } from '@/app/ai/chat/history/idb'

test('external tool selection belongs to a conversation and restores after reopening', async () => {
  const recovery = crypto.randomUUID()
  const editor = {
    state: { documentName: 'MCP selection test' },
    getRecoveryId: () => recovery,
    getSourceIdentity: () => ({ path: null, handle: null }),
    getDocumentFilePath: () => null,
    getStorageBinding: () => null
  }
  const runtime = {
    getEditor: () => editor,
    ensureChat: async () => null,
    profileId: () => null,
    resetChat: async () => undefined,
    backend: () => 'direct'
  }
  const store = createConversationStore()
  const history = createConversationHistory(runtime, store)
  await history.initialize()
  const id = history.current.value?.id
  if (!id) throw new Error('Missing draft')
  await history.rename(id, 'With external tools')
  history.setMCPConnections(['mcp-example'])
  await history.flush()
  await history.newChat()
  expect(history.connectionIds.value).toEqual([])
  await history.open(id)
  expect(history.connectionIds.value).toEqual(['mcp-example'])
  const reopened = createConversationHistory(runtime, createConversationStore())
  await reopened.initialize()
  expect(reopened.current.value?.mcpConnectionIds).toEqual(['mcp-example'])
  await history.remove(id)
})
