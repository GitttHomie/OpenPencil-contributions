<script setup lang="ts">
import { computed, useTemplateRef, watch } from 'vue'

import { useI18n } from '@open-pencil/vue'

import { currentPermission } from '@/app/ai/acp/permission'
import { revokeImagePreviewURL } from '@/app/ai/attachment/image/prepare'
import { chatDocumentId } from '@/app/ai/chat/history/document'
import { useChatRunLocation } from '@/app/ai/chat/run-location'
import type { ChatSubmission } from '@/app/ai/chat/submission/types'
import { saveChatTrace } from '@/app/ai/chat/trace/export'
import { useAIChat } from '@/app/ai/chat/use'
import { designCheckState } from '@/app/ai/design-checks/state'
import { openAISetup } from '@/app/ai/models/settings/onboarding/dialog'
import { didHitStepLimit } from '@/app/ai/tools'
import { getActiveEditorStore } from '@/app/editor/active-store'
import { openSettingsDialog } from '@/app/settings/dialog'
import { toast } from '@/app/shell/ui'
import { activeTab } from '@/app/tabs'
import ACPPermissionDialog from '@/components/chat/ACPPermissionDialog.vue'
import ChatHistory from '@/components/chat/ChatHistory.vue'
import ChatInput from '@/components/chat/ChatInput.vue'
import ChatRunLocation from '@/components/chat/ChatRunLocation.vue'
import ChatRunStatus from '@/components/chat/ChatRunStatus.vue'
import ChatTranscript from '@/components/chat/ChatTranscript.vue'
import DesignReview from '@/components/chat/DesignReview.vue'
import FollowAgentsToggle from '@/components/chat/FollowAgentsToggle.vue'
import ProviderSetup from '@/components/chat/ProviderSetup.vue'

const { isConfigured, history, useSubmission, chatFailure, runStateFor } = useAIChat()
const designCheckStatus = computed(() => designCheckState(getActiveEditorStore()).status.value)

const { ai, credentials, automation } = useI18n()
const runLocation = useChatRunLocation()

const chat = history.chat
const submission = useSubmission({
  messages: computed(() => ({
    openSettings: ai.value.openProviderSettingsAction,
    requestFailed: ai.value.chatRequestFailed,
    visionUnavailable: ai.value.visionModelUnavailable,
    runSetup: ai.value.aiSetupRun,
    agentSetup: {
      'companion-missing': ai.value.chatPiCompanionMissing,
      'companion-outdated': ai.value.chatPiCompanionOutdated,
      'pi-sign-in': ai.value.chatPiSignIn,
      'pi-model': ai.value.chatPiModel
    }
  })),
  reportError: toast.error,
  openModelSettings: () => openSettingsDialog('ai'),
  openSetup: () => openAISetup()
})

const chatInput = useTemplateRef<{ restoreDraft: (submission: ChatSubmission) => void }>(
  'chatInput'
)
let viewGeneration = 0

/** Puts an unsent message back only in the conversation it was written in. */
async function submitMessage(message: ChatSubmission) {
  const generation = viewGeneration
  if (await submission.submit(message)) return
  if (generation === viewGeneration) chatInput.value?.restoreDraft(message)
  else for (const image of message.images) revokeImagePreviewURL(image.previewURL)
}
// Restoring local history must not open a provider connection or read credentials.
void history.initialize().catch(() => {
  toast.error(ai.value.chatHistoryFailed)
})

const messages = computed(() => chat.value?.messages ?? history.messages.value)
const historyOptions = computed(() => {
  const current = history.current.value
  const rows = [...history.conversations.value]
  if (current && !rows.some((row) => row.id === current.id)) rows.unshift(current)
  return rows.map((conversation) => ({
    ...conversation,
    available: conversation.documentId === chatDocumentId(getActiveEditorStore())
  }))
})
const agentHistoryReadOnly = computed(
  () => !chat.value && messages.value.length > 0 && history.current.value?.backend !== 'direct'
)
async function historyAction(action: () => Promise<unknown>) {
  const generation = ++viewGeneration
  submission.cancel()
  try {
    await action()
  } catch {
    if (generation === viewGeneration) toast.error(ai.value.chatHistoryFailed)
  }
}

async function renameConversation(id: string, title: string) {
  try {
    await history.rename(id, title)
  } catch {
    toast.error(ai.value.chatHistoryFailed)
  }
}

async function saveTrace(id: string) {
  const conversation = history.current.value
  if (conversation?.id !== id) return
  try {
    await saveChatTrace(conversation, messages.value)
  } catch {
    toast.error(ai.value.chatTraceFailed)
  }
}

const failureMessage = computed(() => {
  switch (chatFailure.value?.reason) {
    case 'credential-access':
      return [chatFailure.value.connectionName, credentials.value.accessPaused]
        .filter(Boolean)
        .join(': ')
    case 'external-mcp':
      return [chatFailure.value.connectionName, automation.value.mcpFailureUnknown]
        .filter(Boolean)
        .join(': ')
    case 'cli-configuration':
      return ai.value.cliOptionUnavailable
    case 'mcp-unavailable':
      return ai.value.chatCanvasUnavailable
    case 'authentication':
      return ai.value.chatAuthenticationFailed
    case 'forbidden':
      return ai.value.chatForbidden
    case 'insufficient-credit':
      return ai.value.chatInsufficientCredit
    case 'model-not-found':
      return ai.value.chatModelNotFound
    case 'network':
      return ai.value.chatNetworkFailed
    case 'output-limit':
      return ai.value.chatOutputLimit
    case 'rate-limit':
      return ai.value.chatRateLimited
    case 'request-failed':
      return ai.value.chatRequestFailed
    default:
      return null
  }
})
const failureSettingsAction = computed(() => {
  const reason = chatFailure.value?.reason
  if (reason === 'credential-access') {
    return {
      label: credentials.value.settingsTitle,
      run: () => openSettingsDialog('general')
    }
  }
  if (reason === 'external-mcp') {
    return {
      label: automation.value.connections,
      run: () => openSettingsDialog('mcp')
    }
  }
  if (
    [
      'authentication',
      'forbidden',
      'model-not-found',
      'mcp-unavailable',
      'cli-configuration'
    ].includes(reason ?? '')
  ) {
    return { label: ai.value.openProviderSettingsAction, run: () => openSettingsDialog('ai') }
  }
  return undefined
})
const status = computed(() => chat.value?.status ?? 'ready')
const runState = computed(() => runStateFor(chat.value))
const showContinue = computed(() => {
  if (history.readOnly.value || agentHistoryReadOnly.value) return false
  if (status.value !== 'ready') return false
  if (messages.value.length === 0) return false
  if (runState.value) return runState.value.phase === 'limited'
  const last = messages.value[messages.value.length - 1]
  return last.role === 'assistant' && didHitStepLimit()
})

// Asking again clears the failure, and its notice goes with it.
let failureToast: number | null = null
/** The notice outlives a switch to another tab, whose chat its Retry must not touch. */
function retryFailed(messageId: string | undefined): void {
  if (messageId && chat.value?.messages.at(-1)?.id === messageId) void submission.regenerate()
}
watch(
  () => chatFailure.value?.reason,
  (reason) => {
    if (failureToast !== null) toast.remove(failureToast)
    failureToast = null
    if (!reason) return
    const failedId = chat.value?.messages.at(-1)?.id
    failureToast = toast.error(
      failureMessage.value ?? ai.value.chatRequestFailed,
      failureSettingsAction.value ?? {
        label: ai.value.retryRequest,
        run: () => retryFailed(failedId)
      }
    )
  }
)
watch(
  () => [activeTab.value?.id, activeTab.value?.store.state.preparation] as const,
  async ([, preparation]) => {
    if (preparation) {
      viewGeneration++
      submission.cancel()
      return
    }
    const generation = ++viewGeneration
    try {
      await history.initialize()
    } catch {
      if (generation === viewGeneration) {
        toast.error(ai.value.chatHistoryFailed)
      }
    }
  },
  { flush: 'sync' }
)

function handleStop() {
  submission.stop()
}
</script>

<template>
  <div data-test-id="chat-panel" class="flex min-w-0 flex-1 flex-col overflow-hidden select-text">
    <ChatHistory
      :saved="history.conversations.value.some((row) => row.id === history.current.value?.id)"
      :conversations="historyOptions"
      :selected-id="history.current.value?.id"
      :disabled="history.busy.value"
      @create="historyAction(history.newChat)"
      @select="historyAction(() => history.open($event))"
      @rename="renameConversation"
      @save-trace="saveTrace"
      @delete="historyAction(() => history.remove($event))"
    >
      <template #actions><FollowAgentsToggle /></template>
    </ChatHistory>
    <DesignReview
      :disabled="status === 'submitted' || status === 'streaming' || submission.busy.value"
    />
    <p v-if="history.storageError.value" role="alert" class="px-3 py-2 text-xs text-error">
      {{ ai.chatStorageFailed }}
    </p>
    <ProviderSetup v-if="!isConfigured" />

    <template v-if="isConfigured || messages.length">
      <p
        v-if="history.current.value?.interrupted && status === 'ready'"
        role="status"
        class="px-3 py-2 text-xs text-muted"
      >
        {{ ai.chatInterrupted }}
      </p>
      <ChatTranscript
        :messages="messages"
        :status="status"
        :show-continue="showContinue"
        :nodes-live="!history.readOnly.value"
        :interactive="chat !== null && !submission.busy.value"
        @regenerate="submission.regenerate()"
        @revert="(messageId) => submission.revert(messageId)"
        @restore="(messageId) => submission.restore(messageId)"
        @edit="(messageId, text) => submission.resend(messageId, text)"
        @continue="
          submission.submit({
            modelText: 'Continue where you left off',
            displayText: 'Continue where you left off',
            images: [],
            nodes: []
          })
        "
      />

      <p v-if="agentHistoryReadOnly" role="status" class="px-3 py-2 text-xs text-muted">
        {{ ai.chatAgentReadOnly }}
      </p>
      <p v-if="history.readOnly.value" role="status" class="px-3 py-2 text-xs text-muted">
        {{ ai.chatReadOnly }}
      </p>
      <ChatRunStatus
        :check-status="designCheckStatus"
        :run="runState"
        :working="status === 'submitted' || status === 'streaming' || submission.busy.value"
        :waiting="currentPermission !== null"
        :failed="status === 'error' || submission.failed.value"
        :limited="showContinue"
      />
      <ChatRunLocation
        v-if="runLocation"
        :agent="runLocation.agent"
        :page="runLocation.page"
        @open="runLocation.open"
      />
      <ChatInput
        v-if="isConfigured && !agentHistoryReadOnly && !history.readOnly.value"
        ref="chatInput"
        :status="status"
        :disabled="submission.busy.value || history.busy.value"
        @submit="submitMessage"
        @stop="handleStop"
        @error="toast.error"
      />

      <ACPPermissionDialog />
    </template>
  </div>
</template>
