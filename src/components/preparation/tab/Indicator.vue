<script setup lang="ts">
import { computed } from 'vue'

import type { EditorPreparationProgress } from '@/app/editor/preparation/types'
import { preparationPercent } from '@/components/preparation/presentation'
import AppSpinner from '@/components/ui/feedback/AppSpinner.vue'

const { progress } = defineProps<{
  progress: EditorPreparationProgress | null
}>()

const percent = computed(() => preparationPercent(progress))
</script>

<template>
  <span
    role="progressbar"
    :aria-valuenow="percent ?? undefined"
    :aria-valuemin="percent === null ? undefined : 0"
    :aria-valuemax="percent === null ? undefined : 100"
    aria-label="Preparing document"
    class="relative flex size-3 shrink-0 items-center justify-center text-accent"
  >
    <AppSpinner class="size-3" />
  </span>
</template>
