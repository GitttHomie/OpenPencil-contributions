import { computed, type ComputedRef } from 'vue'

import { type Editor } from '@open-pencil/core/editor'
import type { SceneNode } from '@open-pencil/scene-graph'
import {
  layoutSizingUpdates,
  numberPropertyValue,
  sharedNumberGroup,
  independentNumberGroup
} from '@open-pencil/scene-graph'

import type { BindingTarget } from '#vue/controls/binding-provider/types'
import { useNodePreview } from '#vue/controls/node-preview/use'
import { MIXED } from '#vue/controls/node-props/use'
import { useEditor } from '#vue/editor/context'
import { useSelectedNodeState } from '#vue/editor/selection-state/nodes'

export function createNumberPropertyActions(editor: Editor, targets: ComputedRef<BindingTarget[]>) {
  const preview = useNodePreview(editor)
  function update(value: number) {
    const changes = new Map<string, Partial<SceneNode>>()
    for (const target of targets.value) {
      changes.set(target.nodeId, { ...changes.get(target.nodeId), [target.path]: value })
    }
    preview.update(
      [...changes.keys()],
      (id) => {
        const patch = changes.get(id) ?? {}
        const node = editor.getNode(id)
        if (!node) return patch
        const prepared = new Set<string>()
        for (const path of Object.keys(patch)) {
          const group = sharedNumberGroup(node, path)
          if (!group || prepared.has(group.shared)) continue
          prepared.add(group.shared)
          if (group.paths.every((side) => typeof patch[side] === 'number')) {
            patch[group.shared] = value
            if (group.shared === 'strokeWeight')
              patch.strokes = node.strokes.map((stroke) => ({ ...stroke, weight: value }))
          } else {
            Object.assign(patch, { ...independentNumberGroup(node, group), ...patch })
          }
        }
        for (const axis of ['width', 'height'] as const) {
          if (typeof patch[axis] === 'number') {
            Object.assign(
              patch,
              layoutSizingUpdates(
                editor.graph,
                node,
                axis === 'width' ? 'HORIZONTAL' : 'VERTICAL',
                'FIXED'
              )
            )
          }
        }
        return patch
      },
      'Change numeric properties'
    )
  }
  return { update, commit: preview.commit, cancel: preview.cancel }
}

export function useNumberPropertyControls(targets: ComputedRef<BindingTarget[]>) {
  const editor = useEditor()
  const selected = useSelectedNodeState(editor)
  const value = computed(() => {
    const nodes = new Map<string, SceneNode>(selected.nodes.value.map((node) => [node.id, node]))
    const values = targets.value.map((target) => {
      const node = nodes.get(target.nodeId) ?? editor.getNode(target.nodeId)
      return node ? numberPropertyValue(node, target.path) : undefined
    })
    const first = values[0]
    return first !== undefined && values.every((value) => value === first) ? first : MIXED
  })
  return { value, ...createNumberPropertyActions(editor, targets) }
}
