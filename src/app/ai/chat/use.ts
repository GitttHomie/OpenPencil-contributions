import { computed, ref, watch } from 'vue'

import { IS_BROWSER } from '@open-pencil/core/constants'

import { createDocumentChats } from '@/app/ai/chat/documents'
import {
  apiKeyStatus,
  browserCredentialsRemembered,
  credentialsReady,
  customAPIType,
  customBaseURL,
  customModelID,
  isACPProvider,
  isHarnessProvider,
  isConfigured,
  maxOutputTokens,
  modelID,
  providerDef,
  providerID,
  registerAIChatEffects,
  resolveAPIKey,
  setAPIKey
} from '@/app/ai/chat/storage'
import type { SubmissionErrorOptions } from '@/app/ai/chat/submission/errors'
import type { ChatSubmission } from '@/app/ai/chat/submission/types'
import { designModelProfile } from '@/app/ai/models'
import { exposeChatTransportOverride } from '@/app/browser-bridge'
import { getActiveEditorStore } from '@/app/editor/active-store'
import {
  pexelsKeyStatus,
  unsplashKeyStatus,
  setPexelsKey,
  setUnsplashKey,
  setRememberCredentials
} from '@/app/settings/credentials/media'
import { allTabs, getTabForStore } from '@/app/tabs'

export type PropertiesTab = 'design' | 'code' | 'ai' | 'lint'

const activeTab = ref<PropertiesTab>('design')

const documents = createDocumentChats({
  isConfigured,
  isACPProvider,
  isHarnessProvider,
  providerID,
  credentialsReady,
  profileId: () => designModelProfile.value?.id ?? null
})

// Resolve on access: a lazy computed can retain its previous, already closed document.
const current = () => documents.get(getActiveEditorStore())
// Stable UI references follow selection; each invoked action captures its document immediately.
const history = {
  chat: computed(() => current().history.chat.value),
  current: computed(() => current().history.current.value),
  messages: computed(() => current().history.messages.value),
  connectionIds: computed(() => current().history.connectionIds.value),
  conversations: computed(() => current().history.conversations.value),
  readOnly: computed(() => current().history.readOnly.value),
  busy: computed(() => current().history.busy.value),
  storageError: computed(() => current().history.storageError.value),
  initialize: () => current().history.initialize(),
  ensureChat: () => current().history.ensureChat(),
  flush: () => current().history.flush(),
  newChat: () => current().history.newChat(),
  open: (id: string) => current().history.open(id),
  rename: (id: string, title: string) => current().history.rename(id, title),
  remove: (id: string) => current().history.remove(id),
  setMCPConnections: (ids: string[]) => current().history.setMCPConnections(ids)
}

// Navigation leaves sessions alone. Closing a document stops and releases only its own agent.
watch(allTabs, () => {
  for (const editor of documents.editors()) {
    if (!getTabForStore(editor)) void documents.dispose(editor).catch(() => undefined)
  }
})
const chatFailure = computed(() => current().session.failure.value)

function useSubmission(options: SubmissionErrorOptions) {
  const selected = () => current().submission(options)
  return {
    busy: computed(() => selected().busy.value),
    failed: computed(() => selected().failed.value),
    submit: (message: ChatSubmission) => selected().submit(message),
    cancel: () => selected().cancel(),
    stop: () => selected().stop(),
    regenerate: () => selected().regenerate(),
    resend: (id: string, text: string) => selected().resend(id, text),
    revert: (id: string) => selected().revert(id),
    restore: (id: string) => selected().restore(id)
  }
}

registerAIChatEffects(documents.markTransportDirty)

if (IS_BROWSER) {
  exposeChatTransportOverride((factory) => {
    documents.setOverrideTransport(factory)
  })
}

export function useAIChat() {
  return {
    providerID,
    providerDef,
    apiKeyStatus,
    browserCredentialsRemembered,
    setAPIKey,
    resolveAPIKey,
    modelID,
    customBaseURL,
    customModelID,
    customAPIType,
    maxOutputTokens,
    pexelsKeyStatus,
    setPexelsKey,
    setRememberCredentials,
    unsplashKeyStatus,
    setUnsplashKey,
    activeTab,
    isConfigured,
    history,
    ensureChat: history.ensureChat,
    resetChat: history.newChat,
    useSubmission,
    chatFailure,
    clearChatFailure: () => current().session.clearFailure(),
    runStateFor: (chat: typeof history.chat.value) => current().session.runStateFor(chat)
  }
}
