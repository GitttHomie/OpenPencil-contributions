<script setup lang="ts">
import { SelectRoot, SelectTrigger } from 'reka-ui'

import { useSelectionLayout, useRetainedPopup } from '@open-pencil/vue'

import type { SizeLimitFieldProps } from '@/components/properties/layout/size/types'
import VariableNumberField from '@/components/properties/VariableNumberField.vue'
import Tip from '@/components/ui/overlay/Tip.vue'
import AppSelectContent from '@/components/ui/select/AppSelectContent.vue'
import AppSelectItem from '@/components/ui/select/AppSelectItem.vue'

const { item } = defineProps<SizeLimitFieldProps>()

const { nodes, merged, setSizeLimit } = useSelectionLayout()
const { open: popupOpen, portalActive } = useRetainedPopup()

function handleSelect(value: string) {
  if (value === 'CURRENT') setSizeLimit(item.prop, 'current')
  else if (value === 'REMOVE') setSizeLimit(item.prop, 'remove')
}
</script>

<template>
  <Tip :label="item.label">
    <VariableNumberField
      :icon="item.icon"
      :aria-label="item.label"
      :model-value="merged(item.prop) ?? 0"
      :min="0"
      :node-id="nodes[0]?.id ?? ''"
      :node-ids="nodes.map((node) => node.id)"
      edit-properties
      :binding-path="item.prop"
    >
      <template #value-actions>
        <SelectRoot
          v-model:open="popupOpen"
          :model-value="'VALUE'"
          @update:model-value="handleSelect($event as string)"
        >
          <SelectTrigger
            data-slot="limit-trigger"
            :aria-label="item.label"
            class="flex shrink-0 cursor-pointer items-center self-stretch border-none bg-transparent px-1 text-muted outline-none data-[state=open]:text-surface"
            @pointerdown.stop
          >
            <icon-lucide-chevron-down class="size-3" />
          </SelectTrigger>
          <AppSelectContent v-if="portalActive" align="end">
            <AppSelectItem value="CURRENT">{{ item.setLabel }}</AppSelectItem>
            <AppSelectItem value="REMOVE">{{ item.removeLabel }}</AppSelectItem>
          </AppSelectContent>
        </SelectRoot>
      </template>
    </VariableNumberField>
  </Tip>
</template>
