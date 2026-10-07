import { computed, onScopeDispose, ref, watch } from 'vue'
import type { ComputedRef } from 'vue'

import { parseFontStyle } from '@open-pencil/scene-graph'
import type { SceneNode } from '@open-pencil/scene-graph'

import { TYPOGRAPHY_WEIGHTS } from '#vue/controls/typography/actions'
import type { TypographyFontLoader } from '#vue/controls/typography/use'

export function useFontStyleOptions(
  node: ComputedRef<SceneNode | null>,
  loader?: TypographyFontLoader,
  nodes?: ComputedRef<SceneNode[]>
) {
  const targets = computed(() => nodes?.value ?? (node.value ? [node.value] : []))
  const families = computed(() => [...new Set(targets.value.map((target) => target.fontFamily))])
  const revision = ref(0)
  const loading = ref(false)
  let request = 0
  watch(
    () => families.value.join('\0'),
    async () => {
      const current = ++request
      loading.value = false
      if (!loader?.loadStyles) return
      const missing = families.value.filter((family) => !loader.styles?.(family).length)
      if (!missing.length) return
      loading.value = true
      let pending = missing.length
      await Promise.all(
        missing.map(async (family) => {
          try {
            await loader.loadStyles?.(family)
          } finally {
            if (current === request) {
              pending--
              loading.value = pending > 0
              revision.value++
            }
          }
        })
      )
    },
    { immediate: true }
  )
  onScopeDispose(() => {
    request++
  })

  function supports(target: SceneNode, weight: number, italic: boolean) {
    void revision.value
    const faces = (loader?.styles?.(target.fontFamily) ?? []).map(parseFontStyle)
    return (
      !loading.value &&
      (faces.length === 0 || faces.some((face) => face.weight === weight && face.italic === italic))
    )
  }
  const weights = computed(() =>
    TYPOGRAPHY_WEIGHTS.filter(({ value }) =>
      targets.value.every((target) => supports(target, value, target.italic))
    )
  )
  const canToggleBold = computed(() => {
    const weight = targets.value.every((target) => target.fontWeight >= 700) ? 400 : 700
    return targets.value.every((target) => supports(target, weight, target.italic))
  })
  const canToggleItalic = computed(() => {
    const italic = !targets.value.every((target) => target.italic)
    return targets.value.every((target) => supports(target, target.fontWeight, italic))
  })
  return { weights, canToggleBold, canToggleItalic }
}
