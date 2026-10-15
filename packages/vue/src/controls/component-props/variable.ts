import {
  componentPropertyValueSource,
  findComponentPropertyTargets,
  visibilityVariableId
} from '@open-pencil/scene-graph'

import { useOpenPencilBindingProvider } from '#vue/controls/binding-provider/open-pencil'

/** Property defaults and instance assignments use the same picker contract as layer bindings. */
export function useComponentPropertyVariableProvider(kind: () => 'default' | 'instance') {
  return useOpenPencilBindingProvider<boolean>({
    type: 'BOOLEAN',
    getBindingId(editor, target) {
      const owner = editor.graph.getNode(target.nodeId)
      if (!owner) return undefined
      if (kind() === 'default')
        return owner.componentPropertyDefinitions.find((item) => item.id === target.path)
          ?.defaultVariableId
      const resolved = editor.getInstanceComponentPropertyTarget(owner.id, target.path)
      if (!resolved) return undefined
      const layer = findComponentPropertyTargets(
        editor.graph,
        resolved.instance,
        resolved.definition.id
      ).find((item) => item.field === 'VISIBLE')?.node
      return layer
        ? visibilityVariableId(editor.graph, layer)
        : componentPropertyValueSource(editor.graph, resolved.instance, resolved.definition)
            .variableId
    },
    bind(editor, target, id) {
      if (kind() === 'default')
        editor.setComponentPropertyDefaultVariable(target.nodeId, target.path, id)
      else editor.setInstanceComponentPropertyVariable(target.nodeId, target.path, id)
    },
    unbind(editor, target) {
      if (kind() === 'default')
        editor.setComponentPropertyDefaultVariable(target.nodeId, target.path, null)
      else editor.detachInstanceComponentPropertyVariable(target.nodeId, target.path)
    },
    resolve(editor, id, target) {
      const value = target
        ? editor.graph.resolveVariableForNode(target.nodeId, id)
        : editor.graph.resolveVariable(id)
      return typeof value === 'boolean' ? value : undefined
    }
  })
}
