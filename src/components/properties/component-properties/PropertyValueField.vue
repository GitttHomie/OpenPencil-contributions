<script setup lang="ts">
import { ref, watch } from 'vue'

import type { ComponentPropertyType } from '@open-pencil/scene-graph'

import AppInput from '@/components/ui/input/AppInput.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'

import { usePropertyValueFocus } from './usePropertyValueFocus'
const {
  kind,
  value,
  label,
  disabled,
  focusRequest,
  options = []
} = defineProps<{
  kind: ComponentPropertyType
  value: string
  label: string
  disabled?: boolean
  focusRequest?: number
  options?: { value: string; label: string; disabled?: boolean }[]
}>()
const emit = defineEmits<{ update: [value: string] }>()
usePropertyValueFocus(() => focusRequest)
const draft = ref(value)
watch(
  () => value,
  (value) => {
    draft.value = value
  }
)
function commit() {
  if (!disabled && draft.value !== value) emit('update', draft.value)
}
</script>
<template>
  <AppSwitch
    v-if="kind === 'BOOLEAN'"
    :label="label"
    :model-value="value === 'true'"
    :disabled="disabled"
    @update:model-value="emit('update', String($event))"
  />
  <AppInput
    v-else-if="kind === 'TEXT'"
    ref="input"
    v-model="draft"
    :aria-label="label"
    size="xs"
    tone="panel"
    :disabled="disabled"
    @change="commit"
    @enter="commit"
  />
  <AppSelect
    v-else
    :label="label"
    :model-value="value"
    :options="options"
    :disabled="disabled"
    @update:model-value="emit('update', $event)"
  />
</template>
