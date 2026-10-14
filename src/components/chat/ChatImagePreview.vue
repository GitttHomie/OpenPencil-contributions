<script setup lang="ts">
import { ref } from 'vue'

import { useI18n, useAutomationMessages } from '@open-pencil/vue'

import type { ChatImage } from '@/app/ai/chat/media'
import { saveChatImage } from '@/app/ai/chat/save-image'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import { chatToolTheme } from '@/theme/chat/tool'

const { image, label } = defineProps<{ image: ChatImage; label: string }>()
const { common } = useI18n()
const automation = useAutomationMessages()
const failed = ref(false)
const saving = ref(false)
const ui = chatToolTheme()

async function save() {
  failed.value = false
  saving.value = true
  try {
    await saveChatImage(image.url)
  } catch {
    failed.value = true
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <figure class="space-y-2">
    <img :src="image.url" :alt="label" :class="ui.image()" />
    <figcaption class="flex flex-wrap items-center gap-2 text-[10px] text-muted">
      <span>{{ image.mimeType }} · {{ Math.ceil(image.byteLength / 1024) }} KB</span>
      <AppButton size="sm" :loading="saving" @click="save">
        <template #leading><icon-lucide-download /></template>
        {{ common.download }}
      </AppButton>
    </figcaption>
    <AppAlert v-if="failed" tone="error" :heading="automation.imageSaveFailed" />
  </figure>
</template>
