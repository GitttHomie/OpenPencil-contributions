import { guidToString } from '@open-pencil/kiwi/fig/guid'
import { remapComponentPropertyPluginData, type PluginDataEntry } from '@open-pencil/scene-graph'

import {
  getOrCreateNodeGuid,
  getOrCreatePropertyGuid,
  type SceneNodeToKiwiContext
} from './context'

export function nestedPropertyPluginData(
  entries: PluginDataEntry[],
  context: SceneNodeToKiwiContext,
  localIdCounter: { value: number }
): PluginDataEntry[] {
  return remapComponentPropertyPluginData(
    entries,
    (id) => {
      const guid = getOrCreateNodeGuid(context, id, localIdCounter)
      return guid ? guidToString(guid) : id
    },
    (id) => guidToString(getOrCreatePropertyGuid(context, id, localIdCounter))
  )
}
