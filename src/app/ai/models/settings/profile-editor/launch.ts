import { computed } from 'vue'

import { ACP_AGENTS } from '@open-pencil/core/constants'

import { fieldError, integrationFor } from '@/app/ai/acp/configuration/resolve'
import type { AIModelProfileDraft } from '@/app/ai/models/types'

export function useProfileLaunchSettings(draft: AIModelProfileDraft) {
  const agent = computed(() => ACP_AGENTS.find((agent) => `acp:${agent.id}` === draft.providerID))
  const configuration = computed(() =>
    agent.value ? integrationFor(agent.value.id, draft.acpIntegration) : undefined
  )
  const fields = computed(() => configuration.value?.fields ?? [])
  const errors = computed(() =>
    Object.fromEntries(
      fields.value.map((field) => [field.id, fieldError(field, draft.acpLaunch ?? {})])
    )
  )
  const valid = computed(() => !Object.values(errors.value).some(Boolean))

  function updateField(id: string, value: string | number) {
    if (!fields.value.some((field) => field.id === id)) return
    draft.acpLaunch = { ...draft.acpLaunch, [id]: String(value) }
  }

  return { agent, configuration, fields, errors, valid, updateField }
}
