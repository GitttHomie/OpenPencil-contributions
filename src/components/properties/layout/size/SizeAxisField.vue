<script setup lang="ts">
import { SelectRoot, SelectSeparator, SelectTrigger } from 'reka-ui'

import type { LayoutSizing } from '@open-pencil/scene-graph'
import { useI18n, useSelectionLayout, useRetainedPopup } from '@open-pencil/vue'
import type { SizeLimitProp } from '@open-pencil/vue'

import type { SizeAxisFieldProps } from '@/components/properties/layout/size/types'
import VariableNumberField from '@/components/properties/VariableNumberField.vue'
import Tip from '@/components/ui/overlay/Tip.vue'
import AppSelectContent from '@/components/ui/select/AppSelectContent.vue'
import AppSelectItem from '@/components/ui/select/AppSelectItem.vue'

type SizeSelectValue = LayoutSizing | `add-${SizeLimitProp}` | `remove-${SizeLimitProp}`

const { axis, icon, label } = defineProps<SizeAxisFieldProps>()

const selection = useSelectionLayout()
const { nodes, merged, setSizeLimit } = selection
const { open: popupOpen, portalActive } = useRetainedPopup()
const { panels } = useI18n()

const sizing = () => selection.sizing(axis)
const sizingOptions = () =>
  selection.sizingOptions.value.map(({ value }) => ({
    value,
    label: {
      FIXED: panels.value.sizingFixed,
      HUG: panels.value.sizingHug,
      FILL: panels.value.sizingFill
    }[value]
  }))
const sizingLabel = () => {
  if (sizing() === 'HUG') return panels.value.sizingHugShort
  if (sizing() === 'FILL') return panels.value.sizingFillShort
  return ''
}
const limitItems = () =>
  axis === 'width'
    ? [
        {
          prop: 'minWidth' as const,
          addLabel: panels.value.addMinWidth,
          removeLabel: panels.value.removeMinWidth
        },
        {
          prop: 'maxWidth' as const,
          addLabel: panels.value.addMaxWidth,
          removeLabel: panels.value.removeMaxWidth
        }
      ]
    : [
        {
          prop: 'minHeight' as const,
          addLabel: panels.value.addMinHeight,
          removeLabel: panels.value.removeMinHeight
        },
        {
          prop: 'maxHeight' as const,
          addLabel: panels.value.addMaxHeight,
          removeLabel: panels.value.removeMaxHeight
        }
      ]

function handleSelect(value: SizeSelectValue) {
  if (value === 'FIXED' || value === 'HUG' || value === 'FILL') {
    selection.setSizing(axis, value)
    return
  }

  const [action, prop] = value.split('-') as ['add' | 'remove', SizeLimitProp]
  setSizeLimit(prop, action)
}
</script>

<template>
  <Tip :label="label">
    <VariableNumberField
      :icon="icon"
      :aria-label="label"
      :model-value="merged(axis)"
      :min="0"
      :node-id="nodes[0]?.id ?? ''"
      :node-ids="nodes.map((node) => node.id)"
      edit-properties
      :binding-path="axis"
    >
      <template #value-actions>
        <SelectRoot
          v-model:open="popupOpen"
          :model-value="typeof sizing() === 'symbol' ? '' : String(sizing())"
          @update:model-value="handleSelect($event as SizeSelectValue)"
        >
          <SelectTrigger
            data-slot="sizing-trigger"
            :aria-label="label"
            class="flex shrink-0 cursor-pointer items-center gap-0.5 self-stretch border-none bg-transparent px-1.5 text-[10px] text-muted outline-none data-[state=open]:text-surface"
            @pointerdown.stop
          >
            <span v-if="sizingLabel()">{{ sizingLabel() }}</span>
            <icon-lucide-chevron-down class="size-3" />
          </SelectTrigger>
          <AppSelectContent v-if="portalActive" align="end">
            <AppSelectItem
              v-for="option in sizingOptions()"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </AppSelectItem>
            <SelectSeparator class="my-1 h-px bg-border" />
            <AppSelectItem
              v-for="item in limitItems()"
              :key="item.prop"
              :value="`${nodes.some((node) => node[item.prop] == null) ? 'add' : 'remove'}-${item.prop}`"
            >
              {{ nodes.some((node) => node[item.prop] == null) ? item.addLabel : item.removeLabel }}
            </AppSelectItem>
          </AppSelectContent>
        </SelectRoot>
      </template>
    </VariableNumberField>
  </Tip>
</template>
