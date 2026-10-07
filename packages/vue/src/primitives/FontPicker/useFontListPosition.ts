import { shallowRef, watch } from 'vue'
import type { Ref } from 'vue'

import { deferFontListMeasurements } from './resize'
import type { FontVirtualizer } from './resize'
import type { FontFamilyOption } from './useFontPicker'

export function useFontListPosition(options: {
  open: Ref<boolean>
  searchTerm: Ref<string>
  modelValue: Ref<string>
  filtered: Readonly<Ref<FontFamilyOption[]>>
}) {
  const virtualizer = shallowRef<FontVirtualizer>()

  watch(
    [options.open, options.searchTerm, options.modelValue, options.filtered, virtualizer],
    ([open, search, selected, families, list], _, onCleanup) => {
      if (!open || !list || families.length === 0) return
      let frame: number | undefined
      onCleanup(() => {
        if (frame !== undefined) cancelAnimationFrame(frame)
      })
      frame = requestAnimationFrame(() => {
        // Reka highlights the selected row on the opening frame; center after that scroll.
        frame = requestAnimationFrame(() => {
          const index = search ? -1 : families.findIndex((option) => option.family === selected)
          list.scrollToIndex(Math.max(0, index), { align: index < 0 ? 'start' : 'center' })
        })
      })
    },
    { flush: 'post' }
  )

  return (list: FontVirtualizer) => {
    deferFontListMeasurements(list)
    virtualizer.value = list
  }
}
