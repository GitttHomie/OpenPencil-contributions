<script setup lang="ts">
import { computed, normalizeClass, type HTMLAttributes } from 'vue'

import { spinnerTheme } from '@/theme/feedback/spinner'

const { class: className, ui } = defineProps<{
  class?: HTMLAttributes['class']
  ui?: { root?: string; track?: string; arc?: string }
}>()
const styles = computed(() => {
  const theme = spinnerTheme()
  return {
    root: theme.root({ class: [ui?.root, normalizeClass(className)] }),
    track: theme.track({ class: ui?.track }),
    arc: theme.arc({ class: ui?.arc })
  }
})
</script>

<template>
  <span data-slot="spinner" aria-hidden="true" :class="styles.root">
    <span :class="styles.track" />
    <span :class="styles.arc" />
  </span>
</template>
