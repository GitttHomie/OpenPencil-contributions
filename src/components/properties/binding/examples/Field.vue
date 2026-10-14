<script setup lang="ts">
import type { BindingProvider, BindingTarget, BoundEditPolicy } from '@open-pencil/vue'
import {
  BindableValueRoot,
  NumberFieldInput,
  NumberFieldRoot,
  NumberFieldValue
} from '@open-pencil/vue'

import VariableBindingPicker from '@/components/properties/binding/VariableBindingPicker.vue'
import { BindingPill, useBindingFieldUI } from '@/components/ui/binding'

const {
  provider,
  targets,
  label,
  policy = 'detach-on-edit',
  disabled = false,
  derived = false
} = defineProps<{
  provider: BindingProvider<number>
  targets: BindingTarget[]
  label: string
  policy?: BoundEditPolicy
  disabled?: boolean
  derived?: boolean
}>()

const value = defineModel<number>({ required: true })
const styles = useBindingFieldUI()

function tooltip(variableName: string, resolvedValue: unknown) {
  return typeof resolvedValue === 'number' ? `${variableName} · ${resolvedValue}px` : variableName
}
</script>

<template>
  <BindableValueRoot
    v-slot="binding"
    :provider="provider"
    :targets="targets"
    :value="value"
    :policy="policy"
  >
    <NumberFieldRoot
      v-slot="{ attrs, editing, actions }"
      v-model="value"
      :aria-label="label"
      :disabled="disabled"
    >
      <div
        v-bind="{ ...attrs, ...binding.stateAttrs }"
        :class="styles.field"
        :data-derived="derived ? '' : undefined"
        @pointerdown="
          !editing &&
          !($event.target as HTMLElement)?.closest?.('button') &&
          actions.startScrub($event)
        "
      >
        <NumberFieldInput class="min-w-0 flex-1 border-0 bg-transparent px-2 outline-none" />
        <NumberFieldValue :class="styles.content">
          <template #default="display">
            <BindingPill
              v-if="binding.state === 'bound' && binding.variable"
              :label="binding.variable.name"
              :value="binding.mixedValues ? 'Mixed' : binding.resolvedValue"
              :tooltip="tooltip(binding.variable.name, binding.resolvedValue)"
              :disabled="disabled"
              :derived="derived"
            />
            <span v-else-if="display.isMixed" class="min-w-0 flex-1 truncate px-1 text-muted">
              Mixed
            </span>
            <span v-else class="min-w-0 flex-1 truncate px-1">{{ display.value }}</span>
          </template>
        </NumberFieldValue>
        <span :class="styles.actions">
          <VariableBindingPicker
            trigger-label="Apply variable"
            search-placeholder="Search variables"
            empty-label="No variables found"
            detach-label="Detach variable"
            create-label="Create number variable"
            create-name-placeholder="Variable name"
            create-submit-label="Create"
            :disabled="disabled"
            :derived="derived"
          />
        </span>
      </div>
    </NumberFieldRoot>
  </BindableValueRoot>
</template>
