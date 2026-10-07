<script setup lang="ts" generic="T extends { id: string; name: string }">
import { computed, type ComponentPublicInstance } from 'vue'

import { useFlatReorderDrag, usePanelMessages } from '@open-pencil/vue'

import IconButton from '@/components/ui/button/IconButton.vue'
import { reorderListStyles } from '@/theme/panel/reorder-list'

const {
  items,
  disabled = false,
  density = 'comfortable',
  getId = (item: T) => item.id,
  canMove = () => true
} = defineProps<{
  items: readonly T[]
  disabled?: boolean
  density?: 'comfortable' | 'compact'
  getId?: (item: T) => string
  canMove?: (sourceId: string, targetId: string) => boolean
}>()
const emit = defineEmits<{ move: [sourceId: string, index: number] }>()
const panels = usePanelMessages()
const styles = computed(() => reorderListStyles({ density }))
const drag = useFlatReorderDrag({
  items: () => items,
  getId,
  handle: '[data-reorder-handle]',
  canDrag: () => !disabled,
  canMove: (sourceId, targetId) => canMove(sourceId, targetId),
  onMove: (sourceId, index) => emit('move', sourceId, index)
})

function setup(value: Element | ComponentPublicInstance | null, item: T) {
  drag.setupItem(value instanceof HTMLElement ? value : null, () => ({ id: getId(item) }))
}

function moveWithKeyboard(event: KeyboardEvent, item: T, index: number) {
  if (disabled || (event.code !== 'ArrowUp' && event.code !== 'ArrowDown')) return
  event.preventDefault()
  event.stopPropagation()
  const targetIndex = index + (event.code === 'ArrowUp' ? -1 : 1)
  const target = items[targetIndex]
  if (target && canMove(getId(item), getId(target))) emit('move', getId(item), targetIndex)
}
</script>

<template>
  <div :class="styles.list()">
    <div
      v-for="(item, index) in items"
      :key="getId(item)"
      :ref="(element) => setup(element, item)"
      :class="styles.row()"
      :data-dragging="drag.draggingId.value === getId(item) || undefined"
      :data-reorder-id="getId(item)"
    >
      <IconButton
        data-reorder-handle
        :class="styles.handle()"
        :label="panels.reorderItem({ name: item.name })"
        :disabled="disabled || items.length < 2"
        @keydown="moveWithKeyboard($event, item, index)"
      >
        <icon-lucide-grip-vertical class="size-3.5" />
      </IconButton>
      <div :class="styles.content()"><slot :item="item" /></div>
      <div
        v-if="drag.instructionTargetId.value === getId(item)"
        :class="styles.indicator()"
        :data-position="drag.instruction.value?.operation === 'reorder-before' ? 'before' : 'after'"
      />
    </div>
  </div>
</template>
