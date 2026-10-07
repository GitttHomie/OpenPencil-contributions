<script setup lang="ts">
import { useI18n } from '@open-pencil/vue'

import { useACPChatThinking } from '@/app/ai/chat/acp-thinking'
import IconButton from '@/components/ui/button/IconButton.vue'
import { chatComposerTheme } from '@/theme/chat/composer'
import { chatProfileTheme } from '@/theme/chat/profile'

import ACPThinkingSelect from './ACPThinkingSelect.vue'

const { disabled } = defineProps<{ disabled: boolean }>()
const { control, selection, loading, failed, refresh } = useACPChatThinking()
const { ai } = useI18n()
const profile = chatProfileTheme()
const composer = chatComposerTheme()
</script>

<template>
  <ACPThinkingSelect
    v-if="control || selection"
    v-model="selection"
    :control="control"
    :disabled="disabled || loading"
    :ui="{ trigger: profile.trigger({ class: composer.reasoning() }) }"
  />
  <IconButton
    v-if="failed"
    :label="ai.refreshCLIModels"
    :disabled="disabled || loading"
    size="sm"
    @click="refresh"
  >
    <icon-lucide-refresh-cw class="size-3.5" />
  </IconButton>
</template>
