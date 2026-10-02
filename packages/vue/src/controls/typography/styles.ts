import { computed, onScopeDispose, ref, watch } from 'vue'
import type { ComputedRef } from 'vue'

import { parseFontStyle } from '@open-pencil/scene-graph'
import type { SceneNode } from '@open-pencil/scene-graph'

import { TYPOGRAPHY_WEIGHTS } from '#vue/controls/typography/actions'
import type { TypographyFontLoader } from '#vue/controls/typography/use'

export function useFontStyleOptions(
  node: ComputedRef<SceneNode | null>,
  loader?: TypographyFontLoader
) {
  const revision = ref(0)
  const loading = ref(false)
  let request = 0
  watch(
    () => node.value?.fontFamily,
    async (family) => {
      const current = ++request
      loading.value = false
      if (!family || !loader?.loadStyles || loader.styles?.(family).length) return
      loading.value = true
      try {
        await loader.loadStyles(family)
      } finally {
        if (current === request) {
          loading.value = false
          revision.value++
        }
      }
    },
    { immediate: true }
  )
  onScopeDispose(() => {
    request++
  })

  const faces = computed(() => {
    void revision.value
    return (loader?.styles?.(node.value?.fontFamily ?? '') ?? []).map(parseFontStyle)
  })
  const supports = (weight: number, italic: boolean) =>
    !loading.value &&
    (faces.value.length === 0 ||
      faces.value.some((face) => face.weight === weight && face.italic === italic))
  const weights = computed(() => {
    if (loading.value) return []
    return TYPOGRAPHY_WEIGHTS.filter(({ value }) => supports(value, node.value?.italic ?? false))
  })
  const canToggleBold = computed(() =>
    supports((node.value?.fontWeight ?? 400) >= 700 ? 400 : 700, node.value?.italic ?? false)
  )
  const canToggleItalic = computed(() =>
    supports(node.value?.fontWeight ?? 400, !node.value?.italic)
  )
  return { weights, canToggleBold, canToggleItalic }
}
