import type { SceneNode } from '@open-pencil/scene-graph'

import { variableAlias } from '../variable/bindings'
import {
  getOrCreateNodeGuid,
  getOrCreatePropertyGuid,
  parseGuidOrNull,
  type SceneNodeToKiwiContext
} from './context'
import { slotContentAssignment } from './slots'

export function componentPropertyValue(
  type: string,
  value: string,
  context: SceneNodeToKiwiContext,
  localIdCounter: { value: number }
) {
  if (type === 'BOOLEAN') return { boolValue: value === 'true' }
  if (type === 'INSTANCE_SWAP') {
    const target = context.graph.getNode(value)
    const guid = target
      ? getOrCreateNodeGuid(context, target.id, localIdCounter)
      : parseGuidOrNull(value)
    return guid ? { guidValue: guid } : { textValue: { characters: value } }
  }
  return { textValue: { characters: value } }
}

export function componentPropertyVariableValue(
  type: string,
  value: string,
  context: SceneNodeToKiwiContext,
  localIdCounter: { value: number }
) {
  const legacy = componentPropertyValue(type, value, context, localIdCounter)
  if (type === 'BOOLEAN')
    return {
      value: { boolValue: value === 'true' },
      dataType: 'BOOLEAN',
      resolvedDataType: 'BOOLEAN'
    }
  if (type === 'INSTANCE_SWAP' && 'guidValue' in legacy) {
    return {
      value: { symbolIdValue: { guid: legacy.guidValue } },
      dataType: 'SYMBOL_ID',
      resolvedDataType: 'SYMBOL_ID'
    }
  }
  return { value: { textValue: value }, dataType: 'STRING', resolvedDataType: 'STRING' }
}

export function componentPropertyAssignments(
  node: SceneNode,
  context: SceneNodeToKiwiContext,
  localIdCounter: { value: number }
) {
  const ids = new Set([
    ...Object.keys(node.componentPropertyAssignments),
    ...Object.keys(node.componentPropertyVariableAssignments)
  ])
  return [...ids]
    .map((propertyId) => {
      const value = Object.hasOwn(node.componentPropertyAssignments, propertyId)
        ? node.componentPropertyAssignments[propertyId]
        : (context.componentPropertyDefinitionsById.get(propertyId)?.defaultValue ?? 'false')
      const variableId = node.componentPropertyVariableAssignments[propertyId]
      const definition = context.componentPropertyDefinitionsById.get(propertyId)
      if (!definition) return null
      if (definition.type === 'SLOT')
        return slotContentAssignment(
          context,
          node,
          propertyId,
          getOrCreatePropertyGuid(context, propertyId, localIdCounter),
          localIdCounter
        )
      return {
        defID: getOrCreatePropertyGuid(context, propertyId, localIdCounter),
        value: componentPropertyValue(definition.type, value, context, localIdCounter),
        varValue: variableId
          ? {
              dataType: 'ALIAS',
              resolvedDataType: 'BOOLEAN',
              value: { alias: variableAlias(context.graph, variableId, context.varIdToGuid) }
            }
          : componentPropertyVariableValue(definition.type, value, context, localIdCounter)
      }
    })
    .filter((assignment): assignment is NonNullable<typeof assignment> => assignment !== null)
}
