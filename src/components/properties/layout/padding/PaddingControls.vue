<script setup lang="ts">
import { useI18n, useLayoutControlsContext, useSelectionLayout } from '@open-pencil/vue'

import type { PaddingProp } from '@/components/properties/layout/types'
import VariableNumberField from '@/components/properties/VariableNumberField.vue'
import IconButton from '@/components/ui/button/IconButton.vue'

const ctx = useLayoutControlsContext()
const { nodes, merged, allFlex, allGrid } = useSelectionLayout()
const { panels } = useI18n()

const paddingSides: Array<{ prop: PaddingProp; icon: string }> = [
  { prop: 'paddingTop', icon: 'top' },
  { prop: 'paddingRight', icon: 'right' },
  { prop: 'paddingBottom', icon: 'bottom' },
  { prop: 'paddingLeft', icon: 'left' }
]
</script>

<template>
  <div class="flex items-start gap-1.5">
    <div class="min-w-0 flex-1">
      <div v-if="!ctx.showIndividualPadding" class="mt-1.5 grid grid-cols-2 gap-1.5">
        <VariableNumberField
          data-test-id="layout-horizontal-padding-input"
          :model-value="merged('paddingLeft')"
          :min="0"
          :node-id="nodes[0]?.id ?? ''"
          :node-ids="nodes.map((node) => node.id)"
          binding-path="paddingLeft"
          :binding-paths="['paddingLeft', 'paddingRight']"
          edit-properties
        >
          <template #icon>
            <icon-lucide-separator-vertical class="size-3.5" />
          </template>
        </VariableNumberField>
        <VariableNumberField
          data-test-id="layout-vertical-padding-input"
          :model-value="merged('paddingTop')"
          :min="0"
          :node-id="nodes[0]?.id ?? ''"
          :node-ids="nodes.map((node) => node.id)"
          binding-path="paddingTop"
          :binding-paths="['paddingTop', 'paddingBottom']"
          edit-properties
        >
          <template #icon>
            <icon-lucide-separator-horizontal class="size-3.5" />
          </template>
        </VariableNumberField>
      </div>

      <div v-else-if="allGrid || allFlex" class="mt-1.5 grid grid-cols-2 gap-1.5">
        <VariableNumberField
          v-for="side in paddingSides"
          :key="side.prop"
          :model-value="merged(side.prop)"
          :min="0"
          :node-id="nodes[0]?.id ?? ''"
          :node-ids="nodes.map((node) => node.id)"
          :binding-path="side.prop"
          edit-properties
        >
          <template #icon>
            <icon-lucide-panel-top v-if="side.icon === 'top'" class="size-3.5" />
            <icon-lucide-panel-right v-else-if="side.icon === 'right'" class="size-3.5" />
            <icon-lucide-panel-bottom v-else-if="side.icon === 'bottom'" class="size-3.5" />
            <icon-lucide-panel-left v-else class="size-3.5" />
          </template>
        </VariableNumberField>
      </div>
    </div>
    <IconButton
      v-if="allFlex || allGrid"
      :label="panels.individualPadding"
      :active="ctx.showIndividualPadding"
      class="mt-1.5"
      @click="ctx.toggleIndividualPadding"
    >
      <icon-lucide-scan class="size-3.5" />
    </IconButton>
  </div>
</template>
