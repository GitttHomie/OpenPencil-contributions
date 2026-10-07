<script setup lang="ts">
import { MIXED, type MixedValue } from '@open-pencil/vue'

import AppInput from '@/components/ui/input/AppInput.vue'

import { usePropertyValueFocus } from './usePropertyValueFocus'

const { value, label, focusRequest } = defineProps<{
  value: MixedValue<string>
  label: string
  focusRequest?: number
}>()
usePropertyValueFocus(() => focusRequest)
const emit = defineEmits<{ update: [value: string]; commit: [] }>()
</script>

<template>
  <AppInput
    ref="input"
    :model-value="value === MIXED ? '' : value"
    tone="panel"
    size="xs"
    :state="value === MIXED ? 'mixed' : 'idle'"
    :placeholder="value === MIXED ? '—' : undefined"
    :aria-label="label"
    @update:model-value="emit('update', String($event))"
    @blur="emit('commit')"
    @enter="emit('commit')"
  />
</template>
