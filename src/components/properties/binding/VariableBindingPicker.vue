<script lang="ts">
import type { BindingFieldUI } from '@/components/ui/binding'

export interface VariableBindingPickerProps {
  triggerLabel: string
  searchPlaceholder: string
  emptyLabel: string
  detachLabel: string
  closeLabel?: string
  createLabel?: string
  createNamePlaceholder?: string
  createSubmitLabel?: string
  createDefaultName?: string
  disabled?: boolean
  derived?: boolean
  ui?: BindingFieldUI
}
</script>

<script setup lang="ts">
import { isEqual } from 'es-toolkit'
import { computed } from 'vue'

import type { Color } from '@open-pencil/scene-graph/primitives'
import { useBindableValue, useI18n } from '@open-pencil/vue'

import { VariablePicker, type VariablePickerItem } from '@/components/ui/binding'

/** The variable picker of a field inside `BindableValueRoot`, binding the field's targets. */
const {
  triggerLabel,
  searchPlaceholder,
  emptyLabel,
  detachLabel,
  closeLabel,
  createLabel,
  createNamePlaceholder,
  createSubmitLabel,
  createDefaultName,
  disabled,
  derived,
  ui
} = defineProps<VariableBindingPickerProps>()

const binding = useBindableValue<unknown>()
const { panels } = useI18n()
const open = computed({
  get: () => binding.open.value,
  set: (value: boolean) => (value ? binding.actions.openPicker() : binding.actions.closePicker())
})

function previewColor(value: unknown): Color | undefined {
  if (
    value &&
    typeof value === 'object' &&
    'r' in value &&
    typeof value.r === 'number' &&
    'g' in value &&
    typeof value.g === 'number' &&
    'b' in value &&
    typeof value.b === 'number' &&
    'a' in value &&
    typeof value.a === 'number'
  ) {
    return { r: value.r, g: value.g, b: value.b, a: value.a }
  }
}

const previews = computed(() => {
  void binding.provider.revision?.value
  const result = new Map<string, { color?: Color; text?: string }>()
  if (!open.value) return result
  for (const variable of binding.variables.value) {
    if (variable.type !== 'COLOR' && variable.type !== 'FLOAT' && variable.type !== 'STRING')
      continue
    const targets = binding.targets.value
    const values = targets.length
      ? targets.map((target) => binding.provider.resolve(variable.id, target))
      : [binding.provider.resolve(variable.id)]
    const value = values[0]
    if (values.some((candidate) => candidate === undefined)) {
      result.set(variable.id, { text: panels.value.unresolvedVariable })
    } else if (values.some((candidate) => !isEqual(candidate, value))) {
      result.set(variable.id, { text: panels.value.mixedValues })
    } else if (typeof value === 'number' || typeof value === 'string') {
      result.set(variable.id, { text: String(value) })
    } else {
      const color = previewColor(value)
      if (color) result.set(variable.id, { color })
    }
  }
  return result
})

const items = computed<VariablePickerItem[]>(() =>
  binding.variables.value.map((variable) => ({
    id: variable.id,
    name: variable.name,
    collection: binding.provider.collectionName?.(variable),
    ...previews.value.get(variable.id)
  }))
)

defineOptions({ inheritAttrs: false })
</script>

<template>
  <VariablePicker
    v-bind="$attrs"
    :trigger-label="triggerLabel"
    :search-placeholder="searchPlaceholder"
    :empty-label="emptyLabel"
    :detach-label="detachLabel"
    :close-label="closeLabel"
    :create-label="createLabel"
    :create-name-placeholder="createNamePlaceholder"
    :create-submit-label="createSubmitLabel"
    :create-default-name="createDefaultName"
    :disabled="disabled"
    :derived="derived"
    :ui="ui"
    v-model:open="open"
    :items="items"
    :selected="binding.variable.value?.id"
    :state="binding.state.value"
    @select="binding.actions.bind($event)"
    @detach="binding.actions.unbind()"
    @create="binding.actions.create($event)"
  />
</template>
