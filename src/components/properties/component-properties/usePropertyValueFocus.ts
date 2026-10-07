import { nextTick, useTemplateRef, watch } from 'vue'

import type { ComponentPropertyEditTarget } from '@open-pencil/core/editor'

export interface ComponentPropertyFocusRequest extends ComponentPropertyEditTarget {
  request: number
}

export function usePropertyValueFocus(request: () => number | undefined) {
  const input = useTemplateRef<{ focus: () => void; select: () => void }>('input')
  watch(
    request,
    async (value) => {
      if (value === undefined) return
      await nextTick()
      if (request() !== value) return
      input.value?.focus()
      input.value?.select()
    },
    { immediate: true, flush: 'post' }
  )
}
