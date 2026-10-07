<script setup lang="ts">
import { computed } from 'vue'

import type { LayoutMode } from '@open-pencil/scene-graph'
import { useI18n, useSelectionLayout } from '@open-pencil/vue'

import IconButton from '@/components/ui/button/IconButton.vue'
import Tip from '@/components/ui/overlay/Tip.vue'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import SegmentedControl from '@/components/ui/select/SegmentedControl.vue'

const { merged, allFlex, setMode, setWrap } = useSelectionLayout()
const { panels } = useI18n()

const layoutModes = computed<Array<{ value: LayoutMode; label: string }>>(() => [
  { value: 'NONE', label: panels.value.freeform },
  { value: 'VERTICAL', label: panels.value.layoutVertical },
  { value: 'HORIZONTAL', label: panels.value.layoutHorizontal },
  { value: 'GRID', label: panels.value.layoutGrid }
])

function toggleWrap() {
  setWrap(merged('layoutWrap') !== 'WRAP')
}

function setLayoutMode(mode: string) {
  setMode(mode as LayoutMode)
}
</script>

<template>
  <PanelFieldGroup :label="panels.flow">
    <div class="flex items-center gap-1.5">
      <SegmentedControl
        :model-value="typeof merged('layoutMode') === 'symbol' ? '' : String(merged('layoutMode'))"
        :options="layoutModes"
        :label="panels.flow"
        :ui="{ root: 'flex min-w-0 flex-1' }"
        @change="setLayoutMode"
      >
        <template #option="{ option }">
          <Tip :label="option.label">
            <span class="flex items-center justify-center">
              <icon-lucide-move v-if="option.value === 'NONE'" class="size-3.5" />
              <icon-lucide-rows-2 v-else-if="option.value === 'VERTICAL'" class="size-3.5" />
              <icon-lucide-columns-2 v-else-if="option.value === 'HORIZONTAL'" class="size-3.5" />
              <icon-lucide-layout-grid v-else class="size-3.5" />
            </span>
          </Tip>
        </template>
      </SegmentedControl>

      <IconButton
        v-if="allFlex"
        :label="panels.layoutWrap"
        size="xs"
        :active="merged('layoutWrap') === 'WRAP'"
        @click="toggleWrap"
      >
        <icon-lucide-wrap-text class="size-3.5" />
      </IconButton>
    </div>
  </PanelFieldGroup>
</template>
