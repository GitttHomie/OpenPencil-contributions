import { computed, shallowRef, watch } from 'vue'

import { ACP_AGENTS } from '@open-pencil/core/constants'

import type { ACPModelCatalog } from '@/app/ai/acp/models'
import type { ACPThinkingSelection } from '@/app/ai/acp/thinking'
import { useAgentModelLoader } from '@/app/ai/agents/models'
import { designModelProfile, modelConnection } from '@/app/ai/models'
import type { AIModelProfile } from '@/app/ai/models/types'
import { useActiveEditorStoreRef, type EditorStore } from '@/app/editor/active-store'

function createState(profile: AIModelProfile) {
  return {
    profile,
    catalog: shallowRef<ACPModelCatalog>(),
    choice: shallowRef<ACPThinkingSelection | undefined>(
      profile.acpThinking ? { ...profile.acpThinking } : undefined
    ),
    revision: 0,
    publish(catalog: ACPModelCatalog) {
      this.revision++
      this.catalog.value = catalog
    }
  }
}
const states = new WeakMap<EditorStore, ReturnType<typeof createState>>()

export function acpChatThinkingState(store: EditorStore, profile: AIModelProfile) {
  let state = states.get(store)
  if (!state || state.profile !== profile) {
    state = createState(profile)
    states.set(store, state)
  }
  return state
}

export function useACPChatThinking() {
  const store = useActiveEditorStoreRef()
  const load = useAgentModelLoader()
  const state = computed(() => {
    const profile = designModelProfile.value
    if (!store.value || !profile) return null
    const provider = modelConnection(profile.connectionId)?.providerID
    return provider?.startsWith('acp:') ? acpChatThinkingState(store.value, profile) : null
  })
  const loading = shallowRef(false)
  const failed = shallowRef(false)
  const refreshVersion = shallowRef(0)
  watch(
    [state, refreshVersion],
    async ([current], _previous, onCleanup) => {
      loading.value = false
      failed.value = false
      if (!current) return
      const provider = modelConnection(current.profile.connectionId)?.providerID
      const agent = ACP_AGENTS.find((entry) => `acp:${entry.id}` === provider)
      if (!agent) return
      const controller = new AbortController()
      onCleanup(() => controller.abort())
      const revision = current.revision
      loading.value = true
      try {
        const catalog = await load(
          agent.id,
          controller.signal,
          current.profile.customModelID || current.profile.modelID
        )
        if (!controller.signal.aborted && revision === current.revision) current.publish(catalog)
      } catch {
        if (!controller.signal.aborted) failed.value = true
      } finally {
        if (!controller.signal.aborted) loading.value = false
      }
    },
    { immediate: true }
  )
  return {
    loading,
    failed,
    refresh: () => {
      refreshVersion.value++
    },
    control: computed(() => state.value?.catalog.value?.thinking),
    selection: computed({
      get: () => state.value?.choice.value,
      set: (value: ACPThinkingSelection | undefined) => {
        if (state.value) state.value.choice.value = value
      }
    })
  }
}
