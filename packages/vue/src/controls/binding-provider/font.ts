import type { ComputedRef } from 'vue'

import type { SceneNode, Variable } from '@open-pencil/scene-graph'

import { useFamilyFaces } from '#vue/controls/typography/faces'

import { useOpenPencilBindingProvider } from './open-pencil'

/** Weights are chosen in the context of the family they belong to, never as arbitrary numbers. */
export function useFontBindingProvider(
  field: 'fontFamily' | 'fontWeight',
  nodes: ComputedRef<SceneNode[]>
) {
  const { supports } = useFamilyFaces(nodes)
  return useOpenPencilBindingProvider<string | number>({
    type: field === 'fontFamily' ? 'STRING' : 'FLOAT',
    accepts(editor, variable: Variable) {
      return nodes.value.every((node) => {
        const value = editor.graph.resolveVariableForNode(node.id, variable.id)
        if (field === 'fontFamily') return typeof value === 'string' && value.trim().length > 0
        if (typeof value !== 'number' || value < 1 || value > 1000) return false
        const pairedFamily =
          variable.fontFamilyVariableId &&
          editor.graph.resolveVariableForNode(node.id, variable.fontFamilyVariableId)
        if (variable.fontFamilyVariableId && pairedFamily !== node.fontFamily) return false
        return supports(node, value, node.italic)
      })
    },
    resolve(editor, id, target) {
      const value = target
        ? editor.graph.resolveVariableForNode(target.nodeId, id)
        : editor.graph.resolveVariable(id)
      return typeof value === 'string' || typeof value === 'number' ? value : undefined
    },
    create(editor, target, _value, name) {
      editor.createFontVariable(target.nodeId, field, name)
    }
  })
}
