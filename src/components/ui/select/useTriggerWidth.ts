import { unrefElement, useResizeObserver } from '@vueuse/core'
import { computed, onScopeDispose, ref, watch } from 'vue'
import type { ComponentPublicInstance, Ref } from 'vue'

/** Layout width excludes ancestor zoom animations that feed back into popper measurements. */
export function useTriggerWidth(
  trigger: Ref<ComponentPublicInstance | undefined>,
  open: Ref<boolean>
) {
  const width = ref(0)
  const element = computed(() => {
    const resolved = unrefElement(trigger)
    return typeof HTMLElement !== 'undefined' && resolved instanceof HTMLElement
      ? resolved
      : undefined
  })
  let frame: number | undefined
  function measure() {
    if (element.value) width.value = element.value.offsetWidth
  }
  watch(open, (isOpen) => {
    if (isOpen) measure()
  })
  useResizeObserver(element, () => {
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
