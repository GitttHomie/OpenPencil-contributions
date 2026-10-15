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
import { useSelectUI, type SelectUI } from '@/components/ui/select/select'

import FontPickerItem from './FontPickerItem.vue'

const { panels } = useI18n()
/** The placeholder shows while no family is set, such as Mixed for texts in different fonts. */
const {
  label: labelProp,
  placeholder,
  ui: uiOverrides
} = defineProps<{
  label?: string
  placeholder?: string
  ui?: Pick<SelectUI, 'trigger' | 'item' | 'chevron'>
}>()
const label = computed(() => labelProp ?? panels.value.fontFamily)
const modelValue = defineModel<string>({ required: true })
const emit = defineEmits<{ select: [family: string] }>()

const cls = usePopoverUI({
  content: 'w-[var(--reka-combobox-trigger-width)] min-w-56 overflow-hidden p-0'
})
const selectCls = computed(() =>
  useSelectUI({
    ...uiOverrides,
    trigger: ['w-full rounded px-2 py-1', uiOverrides?.trigger].filter(Boolean).join(' '),
    item: ['h-9 w-full gap-2 px-3 py-2 text-sm leading-tight', uiOverrides?.item]
      .filter(Boolean)
      .join(' ')
  })
)

const ui = computed<FontPickerUI>(() => ({
  trigger: selectCls.value.trigger,
  content: cls.content,
  item: selectCls.value.item,
  search:
    'w-full border-b border-border bg-transparent px-3 py-2 text-sm text-surface outline-none placeholder:text-muted',
  empty: 'px-2 py-3 text-center text-xs text-muted',
  emptyAction:
    'mt-2 rounded bg-accent px-2 py-1 text-xs font-medium text-on-accent disabled:opacity-50'
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
        <slot name="value">
          <span class="truncate" :class="{ 'text-muted': !modelValue }">{{
            modelValue || placeholder
          }}</span>
        </slot>
        <icon-lucide-chevron-down :class="selectCls.chevron" />
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
