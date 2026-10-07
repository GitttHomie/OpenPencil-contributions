<script setup lang="ts">
import {
  SelectRoot,
  SelectTrigger,
  SelectPortal,
  SelectContent,
  SelectViewport,
  SelectItem,
  SelectItemText
} from 'reka-ui'
import { computed } from 'vue'

import type { SceneNode } from '@open-pencil/scene-graph'
import { MIXED, useEditor, useI18n, useRetainedPopup } from '@open-pencil/vue'

import VariableNumberField from '@/components/properties/VariableNumberField.vue'
import { useSelectUI } from '@/components/ui/select/select'

const { node, nodes } = defineProps<{ node: SceneNode; nodes?: SceneNode[] }>()
const targets = computed(() => nodes ?? [node])
const emit = defineEmits<{ update: [value: number]; commit: [value: number, previous: number] }>()
const editor = useEditor()
const { open: popupOpen, portalActive } = useRetainedPopup()
const { panels } = useI18n()
const automatic = computed(() =>
  targets.value.every((target) => target.lineHeight == null && !target.boundVariables.lineHeight)
)
const value = computed(() =>
  targets.value.every((target) => target.lineHeight === node.lineHeight)
    ? (node.lineHeight ?? Math.round((node.fontSize || 14) * 1.2))
    : MIXED
)
const menu = useSelectUI()
function setMode(mode: string) {
  editor.undo.runBatch('Change line height mode', () => {
    for (const target of targets.value) {
      if (mode === 'AUTO') {
        if (target.boundVariables.lineHeight) editor.unbindVariable(target.id, 'lineHeight')
        editor.updateNodeWithUndo(target.id, { lineHeight: null }, 'Use automatic line height')
      } else if (mode === 'FIXED' && target.lineHeight == null) {
        editor.updateNodeWithUndo(
          target.id,
          { lineHeight: Math.round((target.fontSize || 14) * 1.2) },
          'Set line height'
        )
      }
    }
  })
}
</script>

<template>
  <VariableNumberField
    :model-value="value"
    :aria-label="panels.lineHeight"
    suffix="px"
    :min="0"
    :node-id="node.id"
    :node-ids="nodes?.map((target) => target.id)"
    :edit-properties="Boolean(nodes)"
    binding-path="lineHeight"
    @update:model-value="emit('update', $event)"
    @commit="(current, previous) => emit('commit', current, previous)"
  >
    <template #icon><icon-lucide-baseline class="size-3" /></template>
    <template v-if="automatic" #display
      ><span class="min-w-0 flex-1 truncate text-surface">{{ panels.auto }}</span></template
    >
    <template #after-variable>
      <SelectRoot
        v-model:open="popupOpen"
        :model-value="automatic ? 'AUTO' : 'FIXED'"
        @update:model-value="setMode"
      >
        <SelectTrigger
          :aria-label="panels.lineHeightMode"
          class="flex shrink-0 items-center self-stretch px-1 text-muted"
          @pointerdown.stop
          ><icon-lucide-chevron-down class="size-3"
        /></SelectTrigger>
        <SelectPortal v-if="portalActive">
          <SelectContent position="popper" :side-offset="4" :class="menu.content">
            <SelectViewport>
              <SelectItem value="AUTO" :class="menu.item"
                ><SelectItemText>{{ panels.auto }}</SelectItemText></SelectItem
              >
              <SelectItem value="FIXED" :class="menu.item"
                ><SelectItemText>{{ panels.sizingFixed }}</SelectItemText></SelectItem
              >
            </SelectViewport>
          </SelectContent>
        </SelectPortal>
      </SelectRoot>
    </template>
  </VariableNumberField>
</template>
