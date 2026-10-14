import { computedAsync } from '@vueuse/core'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'

import { fontManager, FONT_WEIGHT_NAMES } from '@open-pencil/core/text'
import type { Variable } from '@open-pencil/scene-graph'
import { useEditor, useSceneComputed } from '@open-pencil/vue'

/** Resolve the family in the mode being edited, not the canvas's active mode. */
export function useFontToken(variable: MaybeRefOrGetter<Variable>, mode: MaybeRefOrGetter<string>) {
  const editor = useEditor()
  const family = useSceneComputed(() => {
    const current = toValue(variable)
    const definition =
      current.fontFamilyVariableId && editor.graph.variables.get(current.fontFamilyVariableId)
    const value = definition && editor.graph.resolveVariable(definition.id, toValue(mode))
    return {
      name: definition ? definition.name : '',
      value: typeof value === 'string' ? value : ''
    }
  })
  const value = useSceneComputed(() =>
    editor.graph.resolveVariable(toValue(variable).id, toValue(mode))
  )
  const faces = computedAsync(async () => {
    const name = family.value.value
    if (!name) return []
    return (await fontManager.familyFaces(name)) ?? []
  }, [])
  const weights = computed(() =>
    [...new Set(faces.value.map((face) => face.weight))]
      .sort((a, b) => a - b)
      .map((weight) => ({
        value: String(weight),
        label: `${FONT_WEIGHT_NAMES[weight] ?? weight} · ${weight}`
      }))
  )
  return { family, value, weights }
}
