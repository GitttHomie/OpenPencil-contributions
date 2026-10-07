<script setup lang="ts" generic="T extends string | number">
import { useI18n } from '@open-pencil/vue'

import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'

const { label, value, options } = defineProps<{
  label: string
  value: T | symbol
  options: { value: T; label: string }[]
}>()
const emit = defineEmits<{ change: [value: T] }>()
const { panels } = useI18n()

function change(value: T | '') {
  if (value !== '') emit('change', value)
}
</script>

<template>
  <PanelFieldGroup :label="label">
    <AppSelect
      :label="label"
      :model-value="typeof value === 'symbol' ? '' : value"
      :placeholder="panels.mixed"
      :options="options"
      @update:model-value="change"
    />
  </PanelFieldGroup>
</template>
