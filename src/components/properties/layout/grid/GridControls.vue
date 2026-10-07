<script setup lang="ts">
import type { GridTrack, GridTrackSizing } from '@open-pencil/scene-graph'
import { MIXED, useI18n, useLayoutControlsContext, useSelectionLayout } from '@open-pencil/vue'

import NumberField from '@/components/inputs/NumberField.vue'
import type { GridTrackProp } from '@/components/properties/layout/types'
import VariableNumberField from '@/components/properties/VariableNumberField.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import { panelFieldLabelText } from '@/theme/panel/field-group'

const ctx = useLayoutControlsContext()
const { nodes, merged, updateEach } = useSelectionLayout()
function tracks(prop: GridTrackProp) {
  const first = nodes.value[0]?.[prop] ?? []
  return first
    .slice(0, Math.min(...nodes.value.map((node) => node[prop].length)))
    .map((track, index) => ({
      sizing: nodes.value.every((node) => node[prop][index].sizing === track.sizing)
        ? track.sizing
        : MIXED,
      value: nodes.value.every((node) => node[prop][index].value === track.value)
        ? track.value
        : MIXED
    }))
}
function updateTrack(prop: GridTrackProp, index: number, updates: Partial<GridTrack>) {
  updateEach('Change grid track', (node) => ({
    [prop]: node[prop].map((track, i) => (i === index ? { ...track, ...updates } : track))
  }))
}
function addTrack(prop: GridTrackProp) {
  updateEach('Add grid track', (node) => ({ [prop]: [...node[prop], { sizing: 'FR', value: 1 }] }))
}
function removeTrack(prop: GridTrackProp, index: number) {
  updateEach('Remove grid track', (node) => ({ [prop]: node[prop].filter((_, i) => i !== index) }))
}

const { panels } = useI18n()
const trackProps: GridTrackProp[] = ['gridTemplateColumns', 'gridTemplateRows']

function defaultTrackValue(sizing: GridTrackSizing): number {
  if (sizing === 'FR') return 1
  if (sizing === 'FIXED') return 100
  return 0
}
</script>

<template>
  <template v-for="trackProp in trackProps" :key="trackProp">
    <div class="mt-field-group">
      <div class="mb-field-label flex items-end justify-between">
        <label :class="[panelFieldLabelText, 'text-muted']">
          {{ trackProp === 'gridTemplateColumns' ? panels.columns : panels.rows }}
        </label>
        <IconButton
          :label="trackProp === 'gridTemplateColumns' ? panels.addGridColumn : panels.addGridRow"
          @click="addTrack(trackProp)"
        >
          <icon-lucide-plus class="size-3.5" />
        </IconButton>
      </div>
      <div class="flex flex-col gap-1">
        <div v-for="(track, i) in tracks(trackProp)" :key="i" class="flex items-center gap-1">
          <NumberField
            v-if="track.sizing !== 'AUTO'"
            class="flex-1"
            :icon="`${trackProp === 'gridTemplateColumns' ? 'C' : 'R'}${i + 1}`"
            :model-value="track.value"
            :min="track.sizing === 'FR' ? 1 : 0"
            :suffix="track.sizing === 'FR' ? 'fr' : 'px'"
            @update:model-value="updateTrack(trackProp, i, { value: $event })"
          />
          <span v-else class="flex-1 px-1 text-xs text-muted">{{ panels.auto }}</span>
          <AppSelect
            :model-value="typeof track.sizing === 'symbol' ? '' : track.sizing"
            :placeholder="panels.mixed"
            :options="ctx.trackSizingOptions"
            @update:model-value="
              updateTrack(trackProp, i, {
                sizing: $event as GridTrackSizing,
                value: defaultTrackValue($event as GridTrackSizing)
              })
            "
          />
          <IconButton
            v-if="nodes.every((node) => node[trackProp].length > 1)"
            :label="
              trackProp === 'gridTemplateColumns' ? panels.removeGridColumn : panels.removeGridRow
            "
            @click="removeTrack(trackProp, i)"
          >
            <icon-lucide-minus class="size-3.5" />
          </IconButton>
        </div>
      </div>
    </div>
  </template>

  <div class="mt-2 grid grid-cols-2 gap-1.5">
    <VariableNumberField
      :model-value="merged('gridColumnGap')"
      :node-id="nodes[0]?.id ?? ''"
      :node-ids="nodes.map((node) => node.id)"
      binding-path="gridColumnGap"
      edit-properties
      :min="0"
    >
      <template #icon>
        <icon-lucide-move-horizontal class="size-3" />
      </template>
    </VariableNumberField>
    <VariableNumberField
      :model-value="merged('gridRowGap')"
      :node-id="nodes[0]?.id ?? ''"
      :node-ids="nodes.map((node) => node.id)"
      binding-path="gridRowGap"
      edit-properties
      :min="0"
    >
      <template #icon>
        <icon-lucide-move-vertical class="size-3" />
      </template>
    </VariableNumberField>
  </div>
</template>
