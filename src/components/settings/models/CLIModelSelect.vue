<script setup lang="ts">
import { computed } from 'vue'

import { useI18n } from '@open-pencil/vue'

import { useProfileAgentModels } from '@/app/ai/models/settings/profile-editor/agent-models'
import type { AIModelProfileDraft } from '@/app/ai/models/types'
import ProviderSettingsField from '@/components/settings/provider/ProviderSettingsField.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppCombobox from '@/components/ui/select/AppCombobox.vue'

const { draft } = defineProps<{ draft: AIModelProfileDraft }>()
const { ai, common } = useI18n()
const { catalog, loading, failed, available, unknownSelection, refresh, selectModel } =
  useProfileAgentModels(draft)
const DEFAULT_MODEL = '__cli_default__'
const selected = computed({
  get: () => draft.modelID || DEFAULT_MODEL,
  set: (value: string) => selectModel(value === DEFAULT_MODEL ? '' : value)
})
const options = computed(() => {
  const models = (catalog.value?.models ?? []).map((model) => ({
    value: model.id,
    label: model.name,
    description: model.description ?? model.id
  }))
  if (draft.modelID && !models.some((model) => model.value === draft.modelID)) {
    models.unshift({
      value: draft.modelID,
      label: draft.modelID,
      description: catalog.value ? common.value.unavailable : draft.modelID
    })
  }
  return [
    {
      value: DEFAULT_MODEL,
      label: ai.value.cliDefaultModel,
      description:
        catalog.value?.models.find((model) => model.id === catalog.value?.currentModelId)?.name ??
        ''
    },
    ...models
  ]
})
</script>

<template>
  <div class="flex flex-col gap-2">
    <ProviderSettingsField v-slot="{ control }" :label="ai.modelID" :hint="ai.cliModelHint">
      <div class="flex min-w-0 items-center gap-2">
        <div class="min-w-0 flex-1">
          <AppCombobox
            v-bind="control"
            v-model="selected"
            :options="options"
            :label="ai.modelID"
            :search-placeholder="ai.searchModels"
            :empty-label="common.noResults"
            :disabled="loading"
          />
        </div>
        <AppButton size="xs" :disabled="!available" :loading="loading" @click="refresh">
          {{ ai.refreshCLIModels }}
        </AppButton>
      </div>
    </ProviderSettingsField>
    <AppAlert v-if="failed" tone="error" :heading="ai.cliModelsFailed" />
    <AppAlert v-else-if="unknownSelection" :heading="ai.cliModelUnavailable" />
    <p v-else-if="catalog && !catalog.selector" class="text-[11px] text-muted">
      {{ ai.cliModelUnsupported }}
    </p>
  </div>
</template>
