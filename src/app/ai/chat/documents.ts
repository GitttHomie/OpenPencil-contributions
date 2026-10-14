import type { ChatTransport, UIMessage } from 'ai'
import { effectScope, watch } from 'vue'

import type { SubmissionErrorOptions } from '@/app/ai/chat/submission/errors'
import { useChatSubmission } from '@/app/ai/chat/submission/use'
import type { EditorStore } from '@/app/editor/active-store'

import { createConversationHistory } from './history/controller'
import { createChatSessionManager } from './transports'

type DocumentChatOptions = Omit<
  Parameters<typeof createChatSessionManager>[0],
  'getActiveEditorStore' | 'connectionIds'
> & { profileId(): string | null }

/** A transport and its saved conversation live as long as their document, not its view. */
export function createDocumentChats(options: DocumentChatOptions) {
  const sessions = new Map<EditorStore, ReturnType<typeof create>>()
  let override: (() => ChatTransport<UIMessage>) | null = null

  function create(editor: EditorStore) {
    const session = createChatSessionManager({
      ...options,
      getActiveEditorStore: () => editor,
      connectionIds: () => history.connectionIds.value
    })
    session.setOverrideTransport(override)
    const history = createConversationHistory({
      profileId: () => options.profileId(),
      getEditor: () => editor,
      ensureChat: session.ensureChat,
      resetChat: session.resetChat,
      backend: () => {
        if (options.isACPProvider.value) return 'acp'
        return options.isHarnessProvider.value ? 'harness' : 'direct'
      }
    })
    const scope = effectScope(true)
    let submission: ReturnType<typeof useChatSubmission> | undefined
    scope.run(() => {
      watch(history.connectionIds, session.markTransportDirty, {
        deep: true,
        flush: 'sync'
      })
    })
    return {
      session,
      history,
      submission(options: SubmissionErrorOptions) {
        if (!submission) {
          submission = scope.run(() =>
            useChatSubmission({
              ...options,
              chat: history.chat,
              ensureChat: history.ensureChat,
              flush: history.flush,
              clearFailure: session.clearFailure,
              getEditor: () => editor
            })
          )
        }
        if (!submission) throw new Error('The document chat is closed')
        return submission
      },
      async dispose() {
        submission?.cancel()
        scope.stop()
        await history.dispose()
      }
    }
  }

  function get(editor: EditorStore) {
    let document = sessions.get(editor)
    if (!document) {
      document = create(editor)
      sessions.set(editor, document)
    }
    return document
  }

  async function dispose(editor: EditorStore) {
    const document = sessions.get(editor)
    sessions.delete(editor)
    await document?.dispose()
  }

  return {
    get,
    dispose,
    editors: () => [...sessions.keys()],
    markTransportDirty: () => {
      for (const { session } of sessions.values()) session.markTransportDirty()
    },
    setOverrideTransport(factory: (() => ChatTransport<UIMessage>) | null) {
      override = factory
      for (const { session } of sessions.values()) session.setOverrideTransport(factory)
    }
  }
}
