<script setup lang="ts">
import { tv } from 'tailwind-variants'

import tokensPanelTheme from '@/theme/tokens-panel'

import type { FormulaPill } from './source'

const { pill, removeLabel } = defineProps<{ pill: FormulaPill; removeLabel?: string }>()
const emit = defineEmits<{ remove: [] }>()
const ui = tv(tokensPanelTheme)()
</script>

<template>
  <span :class="ui.formulaPill()">
    <span :class="ui.formulaPillLabel()">{{ pill.label }}</span>
    <span :class="ui.formulaPillValue()">{{ pill.displayValue }}</span>
    <button
      v-if="removeLabel"
      type="button"
      :class="ui.formulaPillRemove()"
      :aria-label="removeLabel"
      @pointerdown.prevent
      @click.stop="emit('remove')"
      @keydown.enter.stop.prevent="emit('remove')"
      @keydown.space.stop.prevent="emit('remove')"
    >
      <icon-lucide-x class="size-3" />
    </button>
  </span>
</template>
