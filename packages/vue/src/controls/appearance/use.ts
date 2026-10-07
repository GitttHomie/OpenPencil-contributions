import { ref, watch } from 'vue'

import { createAppearanceActions, createAppearanceState } from '#vue/controls/appearance/helpers'
import { visibilityPropertyName } from '#vue/controls/appearance/visibility'
import { useNodeProps } from '#vue/controls/node-props/use'
import { useEditor } from '#vue/editor/context'
import { useSceneComputed } from '#vue/internal/scene-computed/use'

/**
 * Returns appearance-related state and actions for the current selection.
 *
 * Use this composable for visibility, opacity, and corner-radius controls in
 * property panels.
 */
export function useAppearance() {
  const editor = useEditor()
  const { nodes, node, active, isMulti, merged, updateProp, commitProp } = useNodeProps()

  const expandedCornerNodeId = ref<string | null>(null)
  const collapsedCornerNodeId = ref<string | null>(null)
  const options = { node, nodes, isMulti, merged, expandedCornerNodeId, collapsedCornerNodeId }
  const appearanceState = createAppearanceState(options)
  watch(
    () => nodes.value.map((node) => node.id).join(','),
    (key) => {
      const expanded = createAppearanceState({ node, nodes, isMulti, merged })
        .showIndependentCorners.value
      expandedCornerNodeId.value = expanded ? key : null
      collapsedCornerNodeId.value = expanded ? null : key
    },
    { immediate: true }
  )
  const appearanceActions = createAppearanceActions({ editor, ...options })
  const visibilityPropertyNames = useSceneComputed(() => [
    ...new Set(
      nodes.value
        .map((target) => visibilityPropertyName(editor, target))
        .filter((name): name is string => name !== null)
    )
  ])

  return {
    editor,
    nodes,
    node,
    active,
    isMulti,
    ...appearanceState,
    visibilityPropertyNames,
    updateProp,
    commitProp,
    ...appearanceActions
  }
}
