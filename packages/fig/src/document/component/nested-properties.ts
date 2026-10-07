import type { MaterializedComponentOccurrence } from '#fig/instance-overrides/source-children'

import {
  OPEN_PENCIL_PLUGIN_DATA,
  readPluginData,
  remapComponentPropertyPluginData,
  type SceneNode
} from '@open-pencil/scene-graph'

/** Nested source nodes also occur inside component expansions, outside the shell-source map. */
export function linkNestedPropertyExposures(
  sources: ReadonlyMap<string, string>,
  components: ReadonlyMap<string, MaterializedComponentOccurrence>,
  materialized: readonly SceneNode[]
): void {
  const exposedNodes = materialized.filter(
    (node) =>
      readPluginData(node.pluginData, OPEN_PENCIL_PLUGIN_DATA.exposedComponentProperties)?.length ||
      readPluginData(node.pluginData, OPEN_PENCIL_PLUGIN_DATA.componentPropertyOrder)?.length
  )
  if (!exposedNodes.length) return
  const mapped = new Map(sources)
  for (const { materialized: component } of components.values())
    for (const [occurrence, node] of component.nodes)
      if (!mapped.has(occurrence.sourceId)) mapped.set(occurrence.sourceId, node.id)
  for (const node of exposedNodes) {
    node.pluginData = remapComponentPropertyPluginData(
      node.pluginData,
      (id) => mapped.get(id) ?? id
    )
  }
}
