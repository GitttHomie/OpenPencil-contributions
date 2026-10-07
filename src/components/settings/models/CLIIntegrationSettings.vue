<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'

import { useI18n } from '@open-pencil/vue'

import { useProfileIntegration } from '@/app/ai/models/settings/profile-editor/integration'
import type { AIModelProfileDraft } from '@/app/ai/models/types'
import { focusInvalidField } from '@/components/settings/layout/focus'
import ProviderSettingsField from '@/components/settings/provider/ProviderSettingsField.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppCollapsible from '@/components/ui/collapsible/AppCollapsible.vue'
import AppTextarea from '@/components/ui/input/AppTextarea.vue'

const { draft } = defineProps<{ draft: AIModelProfileDraft }>()
const { ai, common } = useI18n()
const open = ref(false)
const container = useTemplateRef<HTMLDivElement>('container')
const { text, errors, apply, restore } = useProfileIntegration(
  draft,
  computed(() => ai.value.cliIntegrationInvalid)
)
async function applyConfiguration() {
  if (await apply()) open.value = false
  else await focusInvalidField(container.value)
}
</script>

<template>
  <AppCollapsible v-model:open="open">
    <template #label>{{ ai.cliIntegrationTitle }}</template>
    <div ref="container" class="flex flex-col gap-3 border-t border-border p-2.5">
      <ProviderSettingsField
        v-slot="{ control }"
        :label="ai.cliIntegrationConfiguration"
        :hint="ai.cliIntegrationHint"
        :error="errors.configuration"
      >
        <AppTextarea v-bind="control" v-model="text" :rows="8" spellcheck="false" />
      </ProviderSettingsField>
      <div class="flex flex-wrap gap-2">
        <AppButton size="sm" @click="restore">{{ ai.cliIntegrationRestore }}</AppButton>
        <AppButton size="sm" class="ml-auto" @click="open = false">{{ common.cancel }}</AppButton>
        <AppButton size="sm" color="primary" @click="applyConfiguration">{{
          common.apply
        }}</AppButton>
      </div>
    </div>
  </AppCollapsible>
</template>
