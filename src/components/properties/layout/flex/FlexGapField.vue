<script setup lang="ts">
import {
  SelectRoot,
  SelectTrigger,
  SelectPortal,
  SelectContent,
  SelectViewport,
  SelectItem,
  SelectItemText,
  SelectItemIndicator
} from 'reka-ui'
import { computed, ref } from 'vue'

import { useI18n, useSelectionLayout, useRetainedPopup } from '@open-pencil/vue'

import VariableNumberField from '@/components/properties/VariableNumberField.vue'
import { useSelectUI } from '@/components/ui/select/select'
import { panelFieldBase } from '@/theme/panel/field'

const { axis = 'primary' } = defineProps<{ axis?: 'primary' | 'counter' }>()
const { nodes, merged, updateAllWithUndo } = useSelectionLayout()
const { open: popupOpen, portalActive } = useRetainedPopup()
const { panels } = useI18n()
const anchor = ref<HTMLElement | null>(null)
const prop = computed(() => (axis === 'primary' ? 'itemSpacing' : 'counterAxisSpacing'))
const horizontal = computed(() => (merged('layoutMode') === 'HORIZONTAL') === (axis === 'primary'))
const label = computed(() =>
  horizontal.value ? panels.value.horizontalGap : panels.value.verticalGap
)
const auto = computed(
  () =>
    axis === 'primary' &&
    merged('primaryAxisAlign') === 'SPACE_BETWEEN' &&
    nodes.value.every((node) => node.layoutWrap !== 'WRAP')
)
const allowAuto = computed(
  () => axis === 'primary' && nodes.value.every((node) => node.layoutWrap !== 'WRAP')
)
const menu = useSelectUI({ item: 'rounded py-1.5 pr-2 pl-6 text-xs' })
function setMode(value: string) {
  updateAllWithUndo(
    { primaryAxisAlign: value === 'AUTO' ? 'SPACE_BETWEEN' : 'MIN' },
    'Change gap mode'
  )
}
</script>

<template>
  <SelectRoot
    v-model:open="popupOpen"
    :model-value="auto ? 'AUTO' : 'FIXED'"
    @update:model-value="setMode"
  >
    <div ref="anchor" class="min-w-0">
      <div
        v-if="auto"
        data-test-id="layout-gap-input"
        :class="[panelFieldBase, 'flex items-center text-[11px]']"
      >
        <span class="flex min-w-6 shrink-0 items-center justify-center px-[5px] text-muted">
          <icon-lucide-align-horizontal-space-between v-if="horizontal" class="size-3.5" />
          <icon-lucide-align-vertical-space-between v-else class="size-3.5" />
        </span>
        <span class="min-w-0 flex-1 truncate text-right text-surface">{{ panels.auto }}</span>
        <SelectTrigger
          data-test-id="layout-gap-menu"
          :aria-label="label"
          :reference="anchor ?? undefined"
          class="flex shrink-0 items-center self-stretch px-1 text-muted"
          @pointerdown.stop
        >
          <icon-lucide-chevron-down class="size-3" />
        </SelectTrigger>
      </div>
      <VariableNumberField
        v-else
        :data-test-id="axis === 'primary' ? 'layout-gap-input' : 'layout-cross-gap-input'"
        :aria-label="label"
        :model-value="merged(prop)"
        :min="0"
        :node-id="nodes[0]?.id ?? ''"
        :node-ids="nodes.map((node) => node.id)"
        edit-properties
        :binding-path="prop"
      >
        <template #icon>
          <icon-lucide-align-horizontal-space-between v-if="horizontal" class="size-3.5" />
          <icon-lucide-align-vertical-space-between v-else class="size-3.5" />
        </template>
        <template v-if="allowAuto" #after-variable>
          <SelectTrigger
            data-test-id="layout-gap-menu"
            :aria-label="label"
            :reference="anchor ?? undefined"
            class="flex shrink-0 items-center self-stretch px-1 text-muted"
            @pointerdown.stop
          >
            <icon-lucide-chevron-down class="size-3" />
          </SelectTrigger>
        </template>
      </VariableNumberField>
    </div>
    <SelectPortal v-if="allowAuto && portalActive">
      <SelectContent position="popper" align="start" :side-offset="4" :class="menu.content">
        <SelectViewport class="p-0.5">
          <SelectItem
            v-for="mode in ['FIXED', 'AUTO']"
            :key="mode"
            :value="mode"
            :class="menu.item"
          >
            <SelectItemIndicator class="absolute left-1.5 inline-flex items-center justify-center"
              ><icon-lucide-check class="size-3 text-accent"
            /></SelectItemIndicator>
            <SelectItemText>{{
              mode === 'AUTO'
                ? panels.auto
                : typeof merged('itemSpacing') === 'symbol'
                  ? panels.mixed
                  : merged('itemSpacing')
            }}</SelectItemText>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
