<script setup lang="ts">
import { computed } from 'vue'

import { useI18n } from '@open-pencil/vue'

import { useDesignReview } from '@/app/ai/review/use'
import { getActiveEditorStore } from '@/app/editor/active-store'
import { openSettingsDialog } from '@/app/settings/dialog'
import ChatMarkdown from '@/components/chat/ChatMarkdown.vue'
import ProviderSettingsField from '@/components/settings/provider/ProviderSettingsField.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import { AppDialog } from '@/components/ui/dialog'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppInput from '@/components/ui/input/AppInput.vue'

const { disabled = false } = defineProps<{ disabled?: boolean }>()
const { ai, common } = useI18n()
const { open, focus, busy, result, error, model, run, cancel } =
  useDesignReview(getActiveEditorStore)
const errorMessage = computed(() => {
  if (error.value === 'empty') return ai.value.reviewEmpty
  if (error.value === 'unconfigured') return ai.value.reviewNeedsModel
  if (error.value === 'model-unavailable') return ai.value.cliModelUnavailable
  return ai.value.chatRequestFailed
})
function configure() {
  open.value = false
  openSettingsDialog('ai')
}
</script>

<template>
  <div class="flex shrink-0 justify-end p-2.5">
    <AppButton size="xs" variant="outline" :disabled="disabled" @click="open = true">
      <template #leading><icon-lucide-scan-eye class="size-3" /></template>
      {{ ai.reviewDesign }}
    </AppButton>
  </div>
  <AppDialog v-model:open="open" :heading="ai.reviewDesign" :description="ai.reviewDescription">
    <div class="flex flex-col gap-3">
      <AppAlert v-if="!model" :heading="ai.reviewNeedsModel">
        <template #actions>
          <AppButton size="xs" @click="configure">{{ ai.openProviderSettingsAction }}</AppButton>
        </template>
      </AppAlert>
      <template v-else>
        <p class="text-xs text-muted">{{ ai.modelRoleReview }} · {{ model.name }}</p>
        <ProviderSettingsField v-slot="{ control }" :label="ai.reviewFocus">
          <AppInput v-bind="control" v-model="focus" :disabled="busy" />
        </ProviderSettingsField>
      </template>
      <AppAlert v-if="error" tone="error" :heading="errorMessage" />
      <template v-if="result">
        <p role="status" class="text-xs text-muted">
          {{ result.profileName }} ·
          {{ result.imageIncluded ? ai.reviewWithImage : ai.reviewSnapshotOnly }}
        </p>
        <ChatMarkdown :content="result.text" />
      </template>
    </div>
    <template #footer>
      <AppButton v-if="busy" @click="cancel">{{ common.cancel }}</AppButton>
      <AppButton v-else @click="open = false">{{ common.close }}</AppButton>
      <AppButton color="primary" variant="solid" :disabled="!model" :loading="busy" @click="run">
        {{ ai.reviewDesign }}
      </AppButton>
    </template>
  </AppDialog>
</template>
