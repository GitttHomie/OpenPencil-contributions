<script setup lang="ts">
import { computed } from 'vue'

import { FontPickerRoot, useI18n } from '@open-pencil/vue'
import type { FontPickerUI } from '@open-pencil/vue'

import {
  listFamilies,
  loadWebFontPreview,
  localFontAccessState,
  requestLocalFontAccess
} from '@/app/editor/fonts'
import { createFontPreviewQueue } from '@/app/editor/fonts/previews'
import { usePopoverUI } from '@/components/ui/overlay/popover'
import { useSelectUI } from '@/components/ui/select/select'

import FontPickerItem from './FontPickerItem.vue'

const { panels } = useI18n()
const { label: labelProp, placeholder } = defineProps<{ label?: string; placeholder?: string }>()
const label = computed(() => labelProp ?? panels.value.fontFamily)
const modelValue = defineModel<string>({ required: true })
const emit = defineEmits<{ select: [family: string] }>()

const cls = usePopoverUI({
  content: 'w-[var(--reka-combobox-trigger-width)] min-w-56 overflow-hidden p-0'
})
const selectCls = useSelectUI({
  trigger: 'w-full rounded px-2 py-1 text-xs',
  item: 'h-9 w-full gap-2 px-3 py-2 text-sm leading-tight'
})

const ui = computed<FontPickerUI>(() => ({
  trigger: selectCls.trigger,
  content: cls.content,
  item: selectCls.item,
  search:
    'w-full border-b border-border bg-transparent px-3 py-2 text-sm text-surface outline-none placeholder:text-muted',
  empty: 'px-2 py-3 text-center text-xs text-muted',
  emptyAction: 'mt-2 rounded bg-accent px-2 py-1 text-xs font-medium text-white disabled:opacity-50'
}))

const requestPreview = createFontPreviewQueue(loadWebFontPreview)

const localFontAccess = {
  state: localFontAccessState,
  load: requestLocalFontAccess
}
</script>

<template>
  <FontPickerRoot
    v-model="modelValue"
    data-test-id="font-picker-root"
    :list-families="listFamilies"
    :local-font-access="localFontAccess"
    :ui="ui"
    :search-placeholder="panels.searchFonts"
    :empty-search-text="panels.noFontsFound"
    :empty-fonts-text="panels.noLocalFontsAvailable"
    :empty-fonts-hint="panels.localFontsAccessHint"
    @select="emit('select', $event)"
  >
    <template #trigger>
      <button
        type="button"
        data-test-id="font-picker-trigger"
        :aria-label="label"
        :class="selectCls.trigger"
      >
        <span class="truncate">{{ modelValue || placeholder }}</span>
        <icon-lucide-chevron-down class="size-3 shrink-0 text-muted" />
      </button>
    </template>

    <template #item="{ family, selected, source }">
      <FontPickerItem
        :family="family"
        :selected="selected"
        :source="source"
        :request-preview="requestPreview"
      />
    </template>
  </FontPickerRoot>
</template>
