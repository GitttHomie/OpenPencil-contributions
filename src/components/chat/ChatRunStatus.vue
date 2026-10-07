<script setup lang="ts">
import { computed } from 'vue'

import { useI18n } from '@open-pencil/vue'

import type { ChatRunPhase, ChatRunState } from '@/app/ai/chat/run-state'
import AppSpinner from '@/components/ui/feedback/AppSpinner.vue'

const {
  run,
  working,
  waiting,
  failed = false,
  limited = false
} = defineProps<{
  run: ChatRunState | null
  working: boolean
  waiting: boolean
  failed?: boolean
  limited?: boolean
}>()
const { ai } = useI18n()
const phase = computed<ChatRunPhase | 'waiting' | null>(() => {
  if (working) return waiting ? 'waiting' : 'working'
  if (failed) return 'failed'
  if (limited) return 'limited'
  return run?.phase ?? null
})
const label = computed(() => {
  switch (phase.value) {
    case 'working':
      return ai.value.runWorking
    case 'waiting':
      return ai.value.runWaiting
    case 'finished':
      return ai.value.runFinished
    case 'stopped':
      return ai.value.runStopped
    case 'failed':
      return ai.value.runFailed
    case 'interrupted':
      return ai.value.runInterrupted
    case 'limited':
      return ai.value.runLimited
    default:
      return ''
  }
})
</script>

<template>
  <div
    v-if="phase"
    role="status"
    aria-live="polite"
    aria-atomic="true"
    data-test-id="chat-run-status"
    :data-state="phase"
    class="mx-3 mb-2 flex items-center gap-2 rounded-md border border-border bg-panel px-3 py-2 text-xs text-surface"
  >
    <AppSpinner v-if="phase === 'working'" class="size-3.5 shrink-0 text-accent" />
    <icon-lucide-circle-check
      v-else-if="phase === 'finished'"
      class="size-4 shrink-0 text-accent"
    />
    <icon-lucide-circle-pause
      v-else-if="phase === 'waiting' || phase === 'limited'"
      class="size-4 shrink-0 text-muted"
    />
    <icon-lucide-circle-alert v-else class="size-4 shrink-0 text-muted" />
    <span>{{ label }}</span>
  </div>
</template>
