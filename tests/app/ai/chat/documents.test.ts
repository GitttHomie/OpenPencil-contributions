import 'fake-indexeddb/auto'
import { expect, test } from 'bun:test'

import type { ChatTransport, UIMessage, UIMessageChunk } from 'ai'
import { computed, ref } from 'vue'

import type { AIProviderID } from '@open-pencil/core/constants'

import { createDocumentChats } from '@/app/ai/chat/documents'
import { createConversationStore } from '@/app/ai/chat/history/idb'
import { createEditorStore } from '@/app/editor/session/create'
import { createDeferred } from '@/app/runtime/deferred'

function streamingReply() {
  const started = createDeferred<undefined>()
  let controller: ReadableStreamDefaultController<UIMessageChunk> | undefined
  let aborted = false
  const transport: ChatTransport<UIMessage> = {
    async sendMessages({ abortSignal }) {
      abortSignal?.addEventListener(
        'abort',
        () => {
          aborted = true
          controller?.close()
          controller = undefined
        },
        { once: true }
      )
      return new ReadableStream({
        start(stream) {
          controller = stream
          stream.enqueue({ type: 'start', messageId: crypto.randomUUID() })
          stream.enqueue({ type: 'text-start', id: 'answer' })
          stream.enqueue({ type: 'text-delta', id: 'answer', delta: 'Working' })
          started.resolve(undefined)
        }
      })
    },
    async reconnectToStream() {
      return null
    }
  }
  return {
    transport,
    started: started.promise,
    get aborted() {
      return aborted
    },
    finish() {
      controller?.enqueue({ type: 'text-delta', id: 'answer', delta: ' — done' })
      controller?.enqueue({ type: 'text-end', id: 'answer' })
      controller?.enqueue({ type: 'finish', finishReason: 'stop' })
      controller?.close()
      controller = undefined
    }
  }
}

function documents(credentialsReady = Promise.resolve()) {
  return createDocumentChats({
    isConfigured: computed(() => true),
    isACPProvider: computed(() => false),
    isHarnessProvider: computed(() => false),
    providerID: ref<AIProviderID>('openrouter'),
    profileId: () => null,
    credentialsReady
  })
}

test('documents retain independent live replies, MCP selection, and saved history', async () => {
  const first = createEditorStore()
  const second = createEditorStore()
  const chats = documents()
  const replies = [streamingReply(), streamingReply()]
  let created = 0
  chats.setOverrideTransport(() => {
    const reply = replies[created++]
    if (!reply) throw new Error('Unexpected transport recreation')
    return reply.transport
  })
  try {
    const a = chats.get(first)
    const chatA = await a.history.ensureChat()
    if (!chatA) throw new Error('Missing chat')
    a.history.setMCPConnections(['blender'])
    const sendingA = chatA.sendMessage({ text: 'Design the first document' })
    await replies[0].started
    const idA = a.history.current.value?.id

    const b = chats.get(second)
    await b.history.initialize()
    expect(b.history.chat.value).toBeNull()
    expect(b.history.connectionIds.value).toEqual([])
    b.history.setMCPConnections(['other-server'])
    const chatB = await b.history.ensureChat()
    if (!chatB) throw new Error('Missing second chat')
    const sendingB = chatB.sendMessage({ text: 'Design the second document' })
    await replies[1].started

    // Returning to A and even requesting a chat after settings change cannot stop its run.
    chats.markTransportDirty()
    await chats.get(first).history.initialize()
    expect(await a.history.ensureChat()).toBe(chatA)
    expect(a.history.connectionIds.value).toEqual(['blender'])
    expect(replies[0].aborted).toBe(false)
    expect(replies[1].aborted).toBe(false)
    expect(created).toBe(2)

    replies[0].finish()
    await sendingA
    await a.history.flush()
    expect(chatA.status).toBe('ready')
    expect(b.history.chat.value).toBe(chatB)
    expect(replies[1].aborted).toBe(false)
    if (!idA) throw new Error('Missing conversation')
    const saved = await createConversationStore().read(idA)
    expect(saved?.messages.at(-1)?.message.parts).toContainEqual({
      type: 'text',
      text: 'Working — done',
      state: 'done'
    })
    expect(saved?.mcpConnectionIds).toEqual(['blender'])

    // Closing B stops only B, releases its runtime, and preserves the interrupted transcript.
    const idB = b.history.current.value?.id
    await chats.dispose(second)
    await sendingB
    expect(replies[1].aborted).toBe(true)
    expect(replies[0].aborted).toBe(false)
    expect(chats.editors()).toEqual([first])
    if (!idB) throw new Error('Missing second conversation')
    expect((await createConversationStore().read(idB))?.interrupted).toBe(true)
  } finally {
    await Promise.all([chats.dispose(first), chats.dispose(second)])
    first.dispose()
    second.dispose()
  }
})

test('closing a document while its provider initializes cannot attach a late chat', async () => {
  const ready = createDeferred<undefined>()
  const editor = createEditorStore()
  const chats = documents(ready.promise)
  chats.setOverrideTransport(() => streamingReply().transport)
  try {
    const document = chats.get(editor)
    const pending = document.history.ensureChat()
    const closing = chats.dispose(editor)
    ready.resolve(undefined)
    expect(await pending).toBeNull()
    await closing
    expect(document.history.chat.value).toBeNull()
    expect(chats.editors()).toEqual([])
  } finally {
    await chats.dispose(editor)
    editor.dispose()
  }
})

test('a pending submission stays with its document while another chat is opened', async () => {
  const ready = createDeferred<undefined>()
  const first = createEditorStore()
  const second = createEditorStore()
  const chats = documents(ready.promise)
  const reply = streamingReply()
  chats.setOverrideTransport(() => reply.transport)
  const options = {
    messages: ref({
      openSettings: '',
      requestFailed: 'Request failed',
      visionUnavailable: '',
      runSetup: '',
      agentSetup: {
        'companion-missing': '',
        'companion-outdated': '',
        'pi-sign-in': '',
        'pi-model': ''
      }
    }),
    reportError: (message: string) => {
      throw new Error(message)
    },
    openModelSettings: () => undefined,
    openSetup: () => undefined
  }
  try {
    const original = chats.get(first)
    const sending = original.submission(options).submit({
      modelText: 'Design here',
      displayText: 'Design here',
      images: [],
      nodes: []
    })
    const other = chats.get(second)
    await other.history.initialize()
    ready.resolve(undefined)
    await reply.started
    reply.finish()
    expect(await sending).toBe(true)
    expect(original.history.chat.value?.messages[0]?.parts).toContainEqual({
      type: 'text',
      text: 'Design here'
    })
    expect(other.history.chat.value).toBeNull()
    expect(other.history.messages.value).toEqual([])
  } finally {
    ready.resolve(undefined)
    await Promise.all([chats.dispose(first), chats.dispose(second)])
    first.dispose()
    second.dispose()
  }
})
