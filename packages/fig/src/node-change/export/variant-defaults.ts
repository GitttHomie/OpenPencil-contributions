import { guidToString } from '@open-pencil/kiwi/fig/guid'
import {
  OPEN_PENCIL_PLUGIN_DATA,
  readPluginData,
  withPluginData,
  type SceneNode
} from '@open-pencil/scene-graph'

import {
  getOrCreatePropertyGuid,
  getOrCreateNodeGuid,
  type SceneNodeToKiwiContext
} from './context'

/** Property ids and swap targets in custom metadata use the same GUIDs as native fields. */
export function variantDefaultPluginData(
  node: SceneNode,
  context: SceneNodeToKiwiContext,
  localIdCounter: { value: number }
) {
  const field = OPEN_PENCIL_PLUGIN_DATA.componentVariantDefaults
  const defaults = readPluginData(node.pluginData, field)
  if (!defaults) return node.pluginData
  const saved: Record<string, string> = {}
  for (const [id, value] of Object.entries(defaults)) {
    const definition = context.componentPropertyDefinitionsById.get(id)
    if (!definition) continue
    const target =
      definition.type === 'INSTANCE_SWAP'
        ? getOrCreateNodeGuid(context, value, localIdCounter)
        : undefined
    saved[guidToString(getOrCreatePropertyGuid(context, id, localIdCounter))] = target
      ? guidToString(target)
      : value
  }
  return withPluginData(node.pluginData, field, saved)
}
