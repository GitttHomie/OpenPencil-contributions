import type { ComboboxVirtualizer } from 'reka-ui'

type FontListContext = NonNullable<Parameters<typeof ComboboxVirtualizer>[1]>
type FontListSlot = NonNullable<FontListContext['slots']['default']>
export type FontVirtualizer = Parameters<FontListSlot>[0]['virtualizer']

/** Reka exposes the virtualizer in its slot, but does not forward this scheduling option. */
export function deferFontListMeasurements(virtualizer: FontVirtualizer): void {
  if (virtualizer.options.useAnimationFrameWithResizeObserver) return
  virtualizer.setOptions({
    ...virtualizer.options,
    useAnimationFrameWithResizeObserver: true
  })
}
