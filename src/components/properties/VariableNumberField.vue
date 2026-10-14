<script setup lang="ts">
import { computed, useAttrs } from 'vue'

import {
  BindableValueRoot,
  useI18n,
  useNumberBindingProvider,
  useNumberPropertyControls
} from '@open-pencil/vue'
import type { BindingTarget, NumberBindingPath } from '@open-pencil/vue'

import { formatNumber } from '@/app/i18n/number'
import NumberField from '@/components/inputs/NumberField.vue'
import VariableBindingPicker from '@/components/properties/binding/VariableBindingPicker.vue'
import { BindingPill, useBindingFieldUI } from '@/components/ui/binding'
import Tip from '@/components/ui/overlay/Tip.vue'

const {
  modelValue,
  min,
  max,
  step,
  icon,
  label,
  suffix,
  sensitivity,
  placeholder,
  nodeId,
  nodeIds,
  editProperties = false,
  displayScale = 1,
  bindingPath,
  bindingPaths
} = defineProps<{
  modelValue: number | symbol
  min?: number
  max?: number
  step?: number
  icon?: string
  label?: string
  suffix?: string
  sensitivity?: number
  placeholder?: string
  nodeId: string
  nodeIds?: readonly string[]
  editProperties?: boolean
  displayScale?: number
  bindingPath: NumberBindingPath
  bindingPaths?: readonly NumberBindingPath[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
  commit: [value: number, previous: number]
  cancel: []
}>()

const { panels, common } = useI18n()
const provider = useNumberBindingProvider(displayScale)
const attrs = useAttrs()
const targets = computed<BindingTarget[]>(() =>
  (nodeIds ?? [nodeId]).flatMap((id) =>
    (bindingPaths ?? [bindingPath]).map((path) => ({ nodeId: id, path }))
  )
)
const properties = editProperties ? useNumberPropertyControls(targets) : undefined
const fieldValue = computed(() => (properties ? properties.value.value : modelValue))
function update(value: number) {
  if (properties) properties.update(value)
  else emit('update:modelValue', value)
}
function commit(value: number, previous: number) {
  if (properties) properties.commit()
  else emit('commit', value, previous)
}
function cancel() {
  if (properties) properties.cancel()
  else emit('cancel')
}
const accessibleLabel = computed(() => {
  const ariaLabel = attrs['aria-label']
  return typeof ariaLabel === 'string' ? ariaLabel : (label ?? bindingPath)
})
const bindingStyles = useBindingFieldUI()

function bindingTooltip(name: string, resolvedValue: unknown) {
  if (typeof resolvedValue !== 'number') return name
  return `${name} · ${resolvedValue}${suffix ?? ''}`
}

function displayBoundValue(value: unknown): string | undefined {
  if (typeof value !== 'number') return undefined
  const display = formatNumber(displayScale === 100 ? Math.round(value) : value)
  return `${display}${suffix ?? ''}`
}

defineOptions({ inheritAttrs: false })
</script>

<template>
  <BindableValueRoot
    v-slot="binding"
    :provider="provider"
    :targets="targets"
    :value="typeof fieldValue === 'number' ? fieldValue : 0"
  >
    <NumberField
      v-bind="$attrs"
      :icon="icon"
      :label="label"
      :suffix="suffix"
      :sensitivity="sensitivity"
      :placeholder="placeholder"
      :model-value="fieldValue"
      :min="min"
      :max="max"
      :step="step"
      :ui="{ root: bindingStyles.root, display: bindingStyles.content }"
      :data-property="attrs['data-property'] ?? bindingPath"
      :aria-label="accessibleLabel"
      @update:model-value="update"
      @commit="commit"
      @cancel="cancel"
    >
      <template v-if="$slots.icon" #icon>
        <slot name="icon" />
      </template>
      <template v-if="$slots.display" #display="display">
        <slot name="display" v-bind="display" />
      </template>
      <template v-if="binding.variable || binding.state === 'unresolved'" #bound>
        <BindingPill
          :unresolved="binding.unresolved"
          :label="binding.variable?.name ?? binding.bindingId ?? panels.unresolvedVariable"
          :value="binding.mixedValues ? panels.mixed : displayBoundValue(binding.resolvedValue)"
          :tooltip="
            binding.state === 'unresolved'
              ? panels.unresolvedVariable
              : binding.mixedValues
                ? panels.mixedValues
                : bindingTooltip(binding.variable?.name ?? '', binding.resolvedValue)
          "
        />
      </template>
      <template #suffix>
        <span :class="bindingStyles.actions">
          <Tip
            v-if="binding.mixedBindings"
            :label="binding.unresolved ? panels.unresolvedVariable : panels.mixedBindings"
          >
            <span
              data-slot="mixed-bindings"
              :aria-label="binding.unresolved ? panels.unresolvedVariable : panels.mixedBindings"
              class="inline-flex shrink-0 items-center"
            >
              <icon-lucide-unlink class="size-3 text-muted" />
            </span>
          </Tip>
          <Tip v-else-if="binding.mixedValues" :label="panels.mixedValues">
            <span class="text-[10px] text-muted">{{ panels.mixed }}</span>
          </Tip>
          <slot name="value-actions" />
          <VariableBindingPicker
            :trigger-label="panels.applyVariable"
            :search-placeholder="common.search"
            :empty-label="panels.noVariablesFound"
            :detach-label="panels.detachVariable"
            :create-label="
              typeof fieldValue === 'number'
                ? panels.createNumberVariable({ value: fieldValue })
                : undefined
            "
            :create-name-placeholder="panels.variableName"
            :create-submit-label="panels.create"
          />
        </span>
      </template>
    </NumberField>
  </BindableValueRoot>
</template>
