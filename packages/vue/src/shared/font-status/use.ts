import { computed, getCurrentScope, onScopeDispose, ref } from 'vue'

import {
  collectNodeFontFaces,
  fontFaceDemand,
  fontManager,
  fontResolver
} from '@open-pencil/core/text'
import type { SceneNode } from '@open-pencil/scene-graph'

/**
 * Returns missing-font information for a text node getter.
 *
 * This is useful for typography panels and warnings that need to surface fonts
 * that are referenced by a node but not yet loaded in the current runtime.
 */
export function useNodeFontStatus(node: () => SceneNode | null | undefined) {
  const revision = ref(0)
  if (getCurrentScope()) {
    onScopeDispose(fontResolver.subscribe(() => revision.value++))
  }
  const missingFonts = computed(() => {
    void revision.value
    const n = node()
    if (n?.type !== 'TEXT') return []

    return [
      ...new Set(
        collectNodeFontFaces(n)
          .filter(
            ({ family, style }) =>
              !fontManager.isStyleLoaded(family, style) &&
              fontResolver.state(fontFaceDemand(family, style)).state !== 'loading'
          )
          .map(({ family }) => family)
      )
    ]
  })

  const hasMissingFonts = computed(() => missingFonts.value.length > 0)

  return { missingFonts, hasMissingFonts }
}
