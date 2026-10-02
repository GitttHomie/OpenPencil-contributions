import { unrefElement, useResizeObserver } from '@vueuse/core'
import { onScopeDispose, ref, watch } from 'vue'
import type { ComponentPublicInstance, Ref } from 'vue'

/** Layout width excludes ancestor zoom animations that feed back into popper measurements. */
export function useTriggerWidth(
  trigger: Ref<ComponentPublicInstance | undefined>,
  open: Ref<boolean>
) {
  const width = ref(0)
  let frame: number | undefined
  function measure() {
    const element = unrefElement(trigger)
    if (element instanceof HTMLElement) width.value = element.offsetWidth
  }
  watch(open, (isOpen) => {
    if (isOpen) measure()
  })
  useResizeObserver(trigger, () => {
    if (frame !== undefined) return
    frame = requestAnimationFrame(() => {
      frame = undefined
      measure()
    })
  })
  onScopeDispose(() => {
    if (frame !== undefined) cancelAnimationFrame(frame)
  })
  return width
}
