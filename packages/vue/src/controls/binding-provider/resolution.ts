import type { Editor } from '@open-pencil/core/editor'
import { resolveVariableValue, type VariableLiteral } from '@open-pencil/scene-graph'

import type { BindingTarget } from './types'

/** Validate the effective value without substituting values from other modes. */
export function resolveEffectiveBindingValue(
  editor: Editor,
  variableId: string,
  target: BindingTarget,
  visited = new Set<string>()
): VariableLiteral | undefined {
  if (visited.has(variableId) || visited.size >= 64) return undefined
  visited.add(variableId)
  const variable = editor.getVariable(variableId)
  try {
    if (!variable || !editor.getCollection(variable.collectionId)) return undefined
    const mode = editor.graph.getNodeVariableModeId(target.nodeId, variable.collectionId)
    if (!Object.hasOwn(variable.valuesByMode, mode)) return undefined
    return resolveVariableValue(variable.valuesByMode[mode], (id) =>
      resolveEffectiveBindingValue(editor, id, target, visited)
    )
  } finally {
    visited.delete(variableId)
  }
}
