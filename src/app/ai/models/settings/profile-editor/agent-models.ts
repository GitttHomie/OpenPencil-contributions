import { tryOnScopeDispose } from '@vueuse/core'
import { computed, ref, shallowRef, watch } from 'vue'

import type { ACPModelCatalog } from '@/app/ai/acp/models'
import { useAgentModelLoader } from '@/app/ai/agents/models'
import { useLocalAgents } from '@/app/ai/agents/use'
import type { AIModelProfileDraft } from '@/app/ai/models/types'

export function useProfileAgentModels(draft: AIModelProfileDraft) {
  const { availableAgents } = useLocalAgents()
  const load = useAgentModelLoader()
  const catalog = shallowRef<ACPModelCatalog | null>(null)
  const loading = ref(false)
  const failed = ref(false)
  let generation = 0
  let operation: AbortController | null = null
  const agent = computed(() =>
    availableAgents.value.find((candidate) => `acp:${candidate.definition.id}` === draft.providerID)
  )
  const available = computed(() => Boolean(agent.value))

  async function refresh() {
    const version = ++generation
    operation?.abort()
    operation = new AbortController()
    const selected = agent.value
    catalog.value = null
    failed.value = false
    loading.value = Boolean(selected)
    if (!selected) return
    try {
      const result = await load(selected.definition.id, operation.signal)
      if (version === generation) catalog.value = result
    } catch {
      if (version === generation) failed.value = true
    } finally {
      if (version === generation) loading.value = false
    }
  }
  const unknownSelection = computed(() =>
    Boolean(
      draft.modelID &&
      catalog.value &&
      !catalog.value.models.some((model) => model.id === draft.modelID)
    )
  )
  function selectModel(id: string) {
    const providerName = agent.value?.definition.name ?? ''
    const previous = catalog.value?.models.find((model) => model.id === draft.modelID)?.name
    const next = catalog.value?.models.find((model) => model.id === id)?.name
    if (
      !draft.profileId &&
      (!draft.name || draft.name === providerName || draft.name === `${providerName} · ${previous}`)
    ) {
      draft.name = next ? `${providerName} · ${next}` : providerName
    }
    draft.modelID = id
    draft.customModelID = ''
  }
  watch([() => draft.providerID, () => agent.value?.definition.id], () => void refresh(), {
    immediate: true
  })
  tryOnScopeDispose(() => {
    generation++
    operation?.abort()
  })

  return { catalog, loading, failed, available, unknownSelection, refresh, selectModel }
}
