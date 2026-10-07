<script setup lang="ts">
import { computed } from 'vue'

import { useI18n } from '@open-pencil/vue'

import type { ACPThinkingControl, ACPThinkingSelection } from '@/app/ai/acp/thinking'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import type { ComponentUI } from '@/components/ui/types'
import type { AppSelectTheme } from '@/theme/select/app'

const {
  control,
  disabled = false,
  ui
} = defineProps<{
  control?: ACPThinkingControl
  disabled?: boolean
  ui?: ComponentUI<AppSelectTheme>
}>()
const selection = defineModel<ACPThinkingSelection>()
const { ai, common } = useI18n()
const selected = computed({
  get: () => (selection.value ? `option:${selection.value.value}` : 'default'),
  set: (value: string) => {
    const option = control?.options.find((item) => `option:${item.value}` === value)
    selection.value = option && control ? { configId: control.id, value: option.value } : undefined
  }
})
const options = computed(() => {
  const choices = (control?.options ?? []).map((option) => ({
    value: `option:${option.value}`,
    label: option.name
  }))
  if (
    selection.value &&
    (selection.value.configId !== control?.id ||
      !choices.some((option) => option.value === selected.value))
  ) {
    choices.unshift({
      value: selected.value,
      label: `${selection.value.value} (${common.value.unavailable})`
    })
  }
  return [{ value: 'default', label: ai.value.thinkingDefault }, ...choices]
})
</script>

<template>
  <AppSelect
    v-model="selected"
    :label="control?.name || ai.thinkingLevel"
    :options="options"
    :disabled="disabled"
    :ui="ui"
  />
</template>
