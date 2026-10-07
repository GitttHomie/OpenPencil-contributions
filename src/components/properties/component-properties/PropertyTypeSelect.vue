<script setup lang="ts">
import { computed } from 'vue'

import type { ComponentPropertyType } from '@open-pencil/scene-graph'
import { usePanelMessages } from '@open-pencil/vue'

import AppSelect from '@/components/ui/select/AppSelect.vue'

import PropertyTypeIcon from './PropertyTypeIcon.vue'

const kind = defineModel<ComponentPropertyType>({ required: true })
const { disabled, allowSwap = true } = defineProps<{
  disabled?: boolean
  allowSwap?: boolean
}>()
const panels = usePanelMessages()
const options = computed(() => [
  { value: 'TEXT' as const, label: panels.value.componentPropertyString },
  { value: 'BOOLEAN' as const, label: panels.value.componentPropertyBoolean },
  {
    value: 'INSTANCE_SWAP' as const,
    label: panels.value.componentPropertySwap,
    disabled: !allowSwap
  }
])
</script>

<template>
  <AppSelect
    v-model="kind"
    :label="panels.componentPropertyType"
    :options="options"
    :disabled="disabled"
    :ui="{ trigger: 'gap-1.5', item: 'gap-1.5' }"
  >
    <template #value-start>
      <icon-lucide-toggle-left
        v-if="kind === 'BOOLEAN'"
        class="size-3.5 shrink-0 text-muted"
        aria-hidden="true"
      />
      <PropertyTypeIcon v-else :kind="kind" />
    </template>
    <template #option-start="{ option }">
      <icon-lucide-toggle-left
        v-if="option.value === 'BOOLEAN'"
        class="size-3.5 shrink-0 text-muted"
        aria-hidden="true"
      />
      <PropertyTypeIcon v-else :kind="option.value" />
    </template>
  </AppSelect>
</template>
