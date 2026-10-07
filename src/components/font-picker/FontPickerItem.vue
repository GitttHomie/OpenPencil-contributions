<script setup lang="ts">
import { templateRef, useIntersectionObserver } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import type { FontFamilySource } from '@open-pencil/core/text'

import type { FontPreviewRequest } from '@/app/editor/fonts/previews'

const { family, source, selected, requestPreview } = defineProps<{
  family: string
  source: FontFamilySource
  selected: boolean
  requestPreview: FontPreviewRequest
}>()

const row = templateRef<HTMLElement>('row')
const visible = ref(false)
const viewport = computed(() => row.value?.closest<HTMLElement>('[data-reka-combobox-viewport]'))
useIntersectionObserver(
  row,
  ([entry]) => {
    visible.value = entry?.isIntersecting ?? false
  },
  { root: viewport, rootMargin: '36px 0px' }
)
watch(
  [visible, () => family, () => source],
  ([isVisible, family, source], _, onCleanup) => {
    if (isVisible) onCleanup(requestPreview(family, source))
  },
  { flush: 'post' }
)
</script>

<template>
  <div ref="row" data-test-id="font-picker-item" class="flex min-w-0 flex-1 items-center gap-2">
    <icon-lucide-check v-if="selected" class="size-3 shrink-0 text-accent" />
    <span v-else class="size-3 shrink-0" />
    <span class="truncate" :style="{ fontFamily: `'${family}', sans-serif` }">{{ family }}</span>
    <span
      class="font-sans ml-auto shrink-0 rounded bg-input px-1.5 py-0.5 text-[9px] uppercase text-muted"
    >
      {{ source }}
    </span>
  </div>
</template>
