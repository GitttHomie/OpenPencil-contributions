import { computed } from 'vue'

import type { NumericNodeProperty } from '@open-pencil/scene-graph'

import { useNodeProps } from '#vue/controls/node-props/use'
import { usePropScrub } from '#vue/controls/prop-scrub/use'
import { useEditor } from '#vue/editor/context'

/**
 * Returns position-related state and actions for the current selection.
 *
 * This composable is designed for property panels that edit x/y, size,
 * rotation, alignment, flipping, and multi-node transforms.
 */
export function usePosition() {
  const editor = useEditor()

  const { nodes, node, active, isMulti, prop } = useNodeProps()
  const ids = computed(() => nodes.value.map((n) => n.id))
  const parentLayouts = computed(() => {
    void editor.state.sceneVersion
    return nodes.value.map((n) => {
      const parent = n.parentId ? editor.getNode(n.parentId) : null
      return (
        parent?.layoutMode === 'HORIZONTAL' ||
        parent?.layoutMode === 'VERTICAL' ||
        parent?.layoutMode === 'GRID'
      )
    })
  })
  const canExclude = computed(() => nodes.value.length > 0 && parentLayouts.value.every(Boolean))
  const canPosition = computed(() =>
    nodes.value.every(
      (n, index) => !parentLayouts.value[index] || n.layoutPositioning === 'ABSOLUTE'
    )
  )
  const excluded = computed<boolean | 'indeterminate'>(() => {
    const count = nodes.value.filter((n) => n.layoutPositioning === 'ABSOLUTE').length
    if (count === 0) return false
    return count === nodes.value.length ? true : 'indeterminate'
  })

  function setExcluded(value: boolean) {
    if (canExclude.value) editor.setLayoutPositioning(ids.value, value ? 'ABSOLUTE' : 'AUTO')
  }

  const x = computed(() => node.value?.x ?? 0)
  const y = computed(() => node.value?.y ?? 0)
  const width = computed(() => node.value?.width ?? 0)
  const height = computed(() => node.value?.height ?? 0)
  const rotation = computed(() => Math.round(node.value?.rotation ?? 0))

  const {
    updateProp: _updateProp,
    commitProp: _commitProp,
    cancelProp: _cancelProp
  } = usePropScrub(editor)

  function updateProp(key: NumericNodeProperty, value: number) {
    if ((key === 'x' || key === 'y') && !canPosition.value) return
    _updateProp(nodes.value, key, value)
  }

  function commitProp(key: NumericNodeProperty, value: number, previous: number) {
    if ((key === 'x' || key === 'y') && !canPosition.value) return
    _commitProp(nodes.value, key, value, previous)
  }

  function cancelProp(key: NumericNodeProperty) {
    _cancelProp(nodes.value, key)
  }

  function align(axis: 'horizontal' | 'vertical', pos: 'min' | 'center' | 'max') {
    editor.alignNodes(ids.value, axis, pos)
  }

  function flip(axis: 'horizontal' | 'vertical') {
    editor.flipNodes(ids.value, axis)
  }

  function rotate(degrees: number) {
    editor.rotateNodes(ids.value, degrees)
  }

  return {
    editor,
    nodes,
    node,
    active,
    isMulti,
    prop,
    ids,
    canPosition,
    canExclude,
    excluded,
    setExcluded,
    x,
    y,
    width,
    height,
    rotation,
    updateProp,
    commitProp,
    cancelProp,
    align,
    flip,
    rotate
  }
}
