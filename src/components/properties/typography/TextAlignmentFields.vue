<script setup lang="ts">
import { computed } from 'vue'

import type { SceneNode } from '@open-pencil/scene-graph'
import { useI18n } from '@open-pencil/vue'

import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import SegmentedControl from '@/components/ui/select/SegmentedControl.vue'

const { horizontal, vertical } = defineProps<{
  horizontal: SceneNode['textAlignHorizontal'] | symbol
  vertical: SceneNode['textAlignVertical'] | symbol
}>()
defineEmits<{
  horizontal: [value: SceneNode['textAlignHorizontal']]
  vertical: [value: SceneNode['textAlignVertical']]
}>()
const { panels } = useI18n()
const alignmentOptions = computed(() => [
  { value: 'LEFT', label: panels.value.alignLeft },
  { value: 'CENTER', label: panels.value.alignCenterHorizontally },
  { value: 'RIGHT', label: panels.value.alignRight },
  { value: 'JUSTIFIED', label: panels.value.textAlignment }
])
const verticalAlignmentOptions = computed(() => [
  { value: 'TOP', label: panels.value.alignTop },
  { value: 'CENTER', label: panels.value.alignCenterVertically },
  { value: 'BOTTOM', label: panels.value.alignBottom }
])
</script>
<template>
  <PanelFieldGroup :label="panels.textAlignment" class="mb-field-group">
    <SegmentedControl
      :model-value="typeof horizontal === 'symbol' ? '' : horizontal"
      :options="alignmentOptions"
      :label="panels.textAlignment"
      @change="$emit('horizontal', $event as SceneNode['textAlignHorizontal'])"
    >
      <template #option="{ option }">
        <icon-lucide-align-left v-if="option.value === 'LEFT'" class="size-3.5" />
        <icon-lucide-align-center v-else-if="option.value === 'CENTER'" class="size-3.5" />
        <icon-lucide-align-right v-else-if="option.value === 'RIGHT'" class="size-3.5" />
        <icon-lucide-align-justify v-else class="size-3.5" />
      </template>
    </SegmentedControl>
  </PanelFieldGroup>

  <PanelFieldGroup :label="panels.verticalTextAlignment" class="mb-field-group">
    <SegmentedControl
      :model-value="typeof vertical === 'symbol' ? '' : vertical"
      :options="verticalAlignmentOptions"
      :label="panels.verticalTextAlignment"
      @change="$emit('vertical', $event as SceneNode['textAlignVertical'])"
    >
      <template #option="{ option }">
        <icon-lucide-align-vertical-justify-start v-if="option.value === 'TOP'" class="size-3.5" />
        <icon-lucide-align-vertical-justify-center
          v-else-if="option.value === 'CENTER'"
          class="size-3.5"
        />
        <icon-lucide-align-vertical-justify-end v-else class="size-3.5" />
      </template>
    </SegmentedControl>
  </PanelFieldGroup>
</template>
