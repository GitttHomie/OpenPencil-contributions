<script setup lang="ts">
import { computed } from 'vue'

import type { LayoutDirection } from '@open-pencil/scene-graph'
import { useI18n, useSelectionLayout } from '@open-pencil/vue'

import SelectionSelectField from '@/components/properties/selection/SelectionSelectField.vue'

import LayoutAlignmentControl from '../alignment/LayoutAlignmentControl.vue'
import ClipContentControl from '../ClipContentControl.vue'
import PaddingControls from '../padding/PaddingControls.vue'
import FlexGapField from './FlexGapField.vue'

const { panels } = useI18n()
const { nodes, merged, updateAllWithUndo, setPhysicalAlignment } = useSelectionLayout()
const alignmentCells = computed(() => {
  const horizontal = [
    panels.value.alignLeft,
    panels.value.alignCenterHorizontally,
    panels.value.alignRight
  ]
  const vertical = [
    panels.value.alignTop,
    panels.value.alignCenterVertically,
    panels.value.alignBottom
  ]
  const alignments = ['MIN', 'CENTER', 'MAX'] as const
  return alignments.flatMap((y, row) =>
    alignments.map((x, column) => ({
      primary: x,
      counter: y,
      label: `${vertical[row]}, ${horizontal[column]}`,
      active: nodes.value.every(
        (node) =>
          (node.primaryAxisAlign === (node.layoutMode === 'HORIZONTAL' ? x : y) ||
            node.primaryAxisAlign === 'SPACE_BETWEEN') &&
          node.counterAxisAlign === (node.layoutMode === 'HORIZONTAL' ? y : x)
      )
    }))
  )
})
</script>

<template>
  <SelectionSelectField
    :label="panels.direction"
    class="mt-field-group"
    :value="merged('layoutDirection')"
    :options="[
      { value: 'AUTO', label: panels.auto },
      { value: 'LTR', label: 'LTR' },
      { value: 'RTL', label: 'RTL' }
    ]"
    @change="
      updateAllWithUndo({ layoutDirection: $event as LayoutDirection }, 'Change layout direction')
    "
  />
  <div class="mt-2 grid grid-cols-[78px_minmax(0,1fr)] items-start gap-3">
    <LayoutAlignmentControl
      data-test-id="layout-alignment-grid"
      :label="panels.alignment"
      :cells="alignmentCells"
      @select="
        (primary, counter) => {
          if (primary !== 'SPACE_BETWEEN' && counter !== 'BASELINE' && counter !== 'STRETCH')
            setPhysicalAlignment(primary, counter)
        }
      "
    />
    <div class="flex min-w-0 flex-col gap-1.5">
      <FlexGapField />
      <FlexGapField v-if="merged('layoutWrap') === 'WRAP'" axis="counter" />
    </div>
  </div>
  <PaddingControls />
  <ClipContentControl />
</template>
