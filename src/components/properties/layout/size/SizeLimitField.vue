<script setup lang="ts">
import {
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectViewport
} from 'reka-ui'

import { useSelectionLayout, useRetainedPopup } from '@open-pencil/vue'

import type { SizeLimitFieldProps } from '@/components/properties/layout/size/types'
import VariableNumberField from '@/components/properties/VariableNumberField.vue'
import Tip from '@/components/ui/overlay/Tip.vue'
import { useSelectUI } from '@/components/ui/select/select'

const { item } = defineProps<SizeLimitFieldProps>()

const { nodes, merged, setSizeLimit } = useSelectionLayout()
const { open: popupOpen, portalActive } = useRetainedPopup()
const selectUI = useSelectUI({ item: 'rounded py-1.5 px-2 text-xs' })

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
      <template #after-variable>
        <SelectRoot
          v-model:open="popupOpen"
          :model-value="'VALUE'"
          @update:model-value="handleSelect($event as string)"
        >
          <SelectTrigger
            data-slot="limit-trigger"
            :aria-label="item.label"
            class="flex shrink-0 cursor-pointer items-center self-stretch border-none bg-transparent px-1 text-muted outline-none data-[state=open]:text-foreground"
            @pointerdown.stop
          >
            <icon-lucide-chevron-down class="size-3" />
          </SelectTrigger>
          <SelectPortal v-if="portalActive">
            <SelectContent
              position="popper"
              align="start"
              :side-offset="4"
              :class="selectUI.content"
            >
              <SelectViewport class="p-0.5">
                <SelectItem value="CURRENT" :class="selectUI.item">
                  <SelectItemText>{{ item.setLabel }}</SelectItemText>
                </SelectItem>
                <SelectItem value="REMOVE" :class="selectUI.item">
                  <SelectItemText>{{ item.removeLabel }}</SelectItemText>
                </SelectItem>
              </SelectViewport>
            </SelectContent>
          </SelectPortal>
        </SelectRoot>
      </template>
    </VariableNumberField>
  </Tip>
</template>
