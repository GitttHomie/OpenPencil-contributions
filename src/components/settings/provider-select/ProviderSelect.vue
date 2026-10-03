<script setup lang="ts">
import { computed } from 'vue'

import { ACP_AGENTS, AI_PROVIDERS, type AIProviderID } from '@open-pencil/core/constants'
import { useI18n } from '@open-pencil/vue'

import { useLocalAgents } from '@/app/ai/agents/use'
import AppGroupedSelect from '@/components/ui/select/AppGroupedSelect.vue'

const { desktop } = useLocalAgents()
const { ai } = useI18n()

interface ProviderSelectProps {
  allowAgents?: boolean
  ui?: {
    trigger?: string
    content?: string
    item?: string
    label?: string
    separator?: string
  }
}

const { allowAgents = true, ui } = defineProps<ProviderSelectProps>()

const acpAgents = computed(() => (allowAgents && desktop ? ACP_AGENTS : []))

const providerID = defineModel<AIProviderID>({ required: true })
const providerDef = computed(
  () => AI_PROVIDERS.find((provider) => provider.id === providerID.value) ?? AI_PROVIDERS[0]
)

const displayName = computed(() => {
  if (providerID.value === 'harness:pi') return 'Pi'
  if (providerID.value.startsWith('acp:')) {
    const agentId = providerID.value.replace('acp:', '')
    return ACP_AGENTS.find((agent) => agent.id === agentId)?.name ?? providerID.value
  }
  return providerDef.value.name
})

const groups = computed(() => {
  const result: Array<{ label?: string; items: Array<{ value: string; label: string }> }> = []

  if (acpAgents.value.length) {
    result.push({
      label: ai.value.localAgentsTitle,
      items: acpAgents.value.map((agent) => ({
        value: `acp:${agent.id}`,
        label: agent.name
      }))
    })
  }

  result.push({
    label: acpAgents.value.length ? ai.value.provider : undefined,
    items: [...AI_PROVIDERS]
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((provider) => ({
        value: provider.id,
        label: provider.name
      }))
  })

  return result
})
</script>

<template>
  <AppGroupedSelect v-model="providerID" :groups="groups" :display-value="displayName" :ui="ui" />
</template>
