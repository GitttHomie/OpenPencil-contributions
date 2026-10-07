<script setup lang="ts">
import { ref, watch } from 'vue'

import { useAIMessages } from '@open-pencil/vue'

import { useProfileLaunchSettings } from '@/app/ai/models/settings/profile-editor/launch'
import type { AIModelProfileDraft } from '@/app/ai/models/types'
import CLIIntegrationSettings from '@/components/settings/models/CLIIntegrationSettings.vue'
import ProviderSettingsField from '@/components/settings/provider/ProviderSettingsField.vue'
import AppCollapsible from '@/components/ui/collapsible/AppCollapsible.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'

const { draft } = defineProps<{ draft: AIModelProfileDraft }>()
const ai = useAIMessages()
const { fields, errors, valid, updateField } = useProfileLaunchSettings(draft)
const errorMessages = {
  characters: 'cliFieldCharacters',
  identifier: 'cliFieldIdentifier',
  region: 'cliFieldRegion',
  choice: 'cliFieldChoice',
  url: 'cliFieldURL',
  dependency: 'cliFieldDependency'
} as const
function errorLabel(id: string) {
  const error = errors.value[id]
  return error ? ai.value[errorMessages[error]] : undefined
}
const open = ref(false)
watch(
  valid,
  (value) => {
    if (!value) open.value = true
  },
  { immediate: true }
)
</script>

<template>
  <AppCollapsible
    v-model:open="open"
    :ui="{
      root: 'rounded border border-border',
      trigger: 'px-2.5 py-2 text-[11px] text-muted hover:text-surface',
      icon: 'size-3'
    }"
  >
    <template #label>{{ ai.cliLaunchSettings }}</template>
    <div class="flex flex-col gap-3 border-t border-border p-2.5">
      <p class="text-[11px] text-muted">{{ ai.cliLaunchHint }}</p>
      <ProviderSettingsField
        v-for="field in fields"
        :key="field.id"
        v-slot="{ control }"
        :label="field.labelKey ? ai[field.labelKey] : field.label"
        :hint="field.hintKey ? ai[field.hintKey] : field.hint"
        :clear-label="draft.acpLaunch?.[field.id] ? ai.cliUseDefault : undefined"
        :error="errorLabel(field.id)"
        @clear="updateField(field.id, '')"
      >
        <AppSelect
          v-if="field.type === 'select'"
          v-bind="control"
          :model-value="draft.acpLaunch?.[field.id] || ''"
          :options="field.options ?? []"
          :placeholder="ai.cliUseDefault"
          @update:model-value="updateField(field.id, $event)"
        />
        <AppInput
          v-else
          v-bind="control"
          :model-value="draft.acpLaunch?.[field.id] ?? ''"
          :type="field.type === 'url' ? 'url' : 'text'"
          :placeholder="ai.cliUseDefault"
          size="sm"
          @update:model-value="updateField(field.id, $event)"
        />
      </ProviderSettingsField>
      <CLIIntegrationSettings :draft="draft" />
    </div>
  </AppCollapsible>
</template>
