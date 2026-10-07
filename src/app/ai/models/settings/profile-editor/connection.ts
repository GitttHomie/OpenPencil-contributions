import { tryOnScopeDispose } from '@vueuse/core'
import { computed, ref, toRaw, watch, type Ref } from 'vue'

import { useAgentModelVerifier } from '@/app/ai/agents/verification'
import {
  testProviderConnection,
  type ProviderConnectionTestFailureReason
} from '@/app/ai/chat/connection-test'
import {
  findModelConnectionForDraft,
  modelConnectionCredentialStatus,
  resolveModelConnectionAPIKey,
  type AIModelProfileDraft
} from '@/app/ai/models'
import type { CredentialStatus } from '@/app/settings/credentials/types'

interface ConnectionOptions {
  draft: AIModelProfileDraft
  keyInput: Ref<string>
}

export function useProfileConnection({ draft, keyInput }: ConnectionOptions) {
  const verifyAgent = useAgentModelVerifier()
  let operation: AbortController | null = null
  const keyStatus = ref<CredentialStatus>('missing')
  const connectionTestStatus = ref<'idle' | 'testing' | 'success' | 'error'>('idle')
  const connectionTestReason = ref<ProviderConnectionTestFailureReason | null>(null)

  const keyCleared = ref(false)
  const hasExistingKey = computed(() => !keyCleared.value && keyStatus.value === 'configured')

  let version = 0
  let disposed = false
  tryOnScopeDispose(() => {
    disposed = true
    version++
    operation?.abort()
  })
  function current(request: number) {
    return !disposed && request === version
  }

  function resetConnectionTest(): void {
    version++
    operation?.abort()
    connectionTestStatus.value = 'idle'
    connectionTestReason.value = null
  }

  async function refreshKeyStatus(): Promise<void> {
    const request = version
    const connection = findModelConnectionForDraft(draft)
    try {
      const status = connection ? await modelConnectionCredentialStatus(connection.id) : 'missing'
      if (current(request)) keyStatus.value = status
    } catch {
      if (current(request)) keyStatus.value = 'unavailable'
    }
  }

  function clearKey(): void {
    keyCleared.value = true
    keyInput.value = ''
    resetConnectionTest()
  }

  async function testConnection(): Promise<void> {
    operation?.abort()
    operation = new AbortController()
    const signal = operation.signal
    const request = ++version
    const target = structuredClone(toRaw(draft))
    const replacement = keyInput.value.trim()
    connectionTestStatus.value = 'testing'
    connectionTestReason.value = null
    try {
      if (target.providerID.startsWith('acp:')) {
        const result = await verifyAgent(target, signal)
        if (!current(request)) return
        connectionTestStatus.value = result.ok ? 'success' : 'error'
        connectionTestReason.value = result.ok ? null : result.reason
        return
      }
      const connection = findModelConnectionForDraft(target)
      const existingKey =
        !replacement && !keyCleared.value && connection
          ? await resolveModelConnectionAPIKey(connection.id)
          : null
      if (!current(request)) return
      const result = await testProviderConnection({
        providerID: target.providerID,
        apiKey: replacement || existingKey || '',
        modelID: target.modelID,
        customModelID: target.customModelID,
        customBaseURL: target.customBaseURL,
        customAPIType: target.customAPIType
      })
      if (!current(request)) return
      connectionTestStatus.value = result.ok ? 'success' : 'error'
      connectionTestReason.value = result.ok ? null : result.reason
    } catch {
      if (!current(request)) return
      connectionTestStatus.value = 'error'
      connectionTestReason.value = 'unknown'
    }
  }

  watch(
    () => [
      draft.providerID,
      draft.modelID,
      draft.customModelID,
      draft.customBaseURL,
      draft.customAPIType,
      draft.acpLaunch,
      draft.acpIntegration,
      draft.acpOptions,
      draft.acpThinking,
      keyInput.value
    ],
    resetConnectionTest,
    { deep: true, flush: 'sync' }
  )

  return {
    keyCleared,
    keyStatus,
    connectionTestStatus,
    connectionTestReason,
    hasExistingKey,
    resetConnectionTest,
    refreshKeyStatus,
    clearKey,
    testConnection
  }
}
