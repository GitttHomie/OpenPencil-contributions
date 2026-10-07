/** An exposed control keeps the nested occurrence's identity separate from its property's id. */
export function nestedPropertyId(nodeId: string, propertyId: string): string {
  return `nested/${nodeId}/${propertyId}`
}

/** Remap the node path and final property id together for document export, import and copying. */
export function remapExposedPropertyId(
  id: string,
  nodeId: (id: string) => string,
  propertyId: (id: string) => string = (id) => id
): string {
  const path = id.split('/')
  if (path[0] !== 'nested' || path.length < 3) return propertyId(id)
  return nestedPropertyId(
    nodeId(path[1]),
    remapExposedPropertyId(path.slice(2).join('/'), nodeId, propertyId)
  )
}
import { readPluginData, withPluginData } from '../plugin-data/field'
import { OPEN_PENCIL_PLUGIN_DATA } from '../plugin-data/fields'
import type { PluginDataEntry, SceneNode } from '../types'

export function orderComponentProperties<T extends { id: string }>(
  items: T[],
  owners: SceneNode[]
): T[] {
  const ids = owners.flatMap(
    (owner) =>
      readPluginData(owner.pluginData, OPEN_PENCIL_PLUGIN_DATA.componentPropertyOrder) ?? []
  )
  const ranks = new Map([...new Set(ids)].map((id, index) => [id, index]))
  return items.toSorted((a, b) => (ranks.get(a.id) ?? ranks.size) - (ranks.get(b.id) ?? ranks.size))
}

export function remapComponentPropertyPluginData(
  entries: PluginDataEntry[],
  nodeId: (id: string) => string,
  propertyId: (id: string) => string = (id) => id
): PluginDataEntry[] {
  for (const field of [
    OPEN_PENCIL_PLUGIN_DATA.exposedComponentProperties,
    OPEN_PENCIL_PLUGIN_DATA.componentPropertyOrder
  ]) {
    const ids = readPluginData(entries, field)
    if (ids)
      entries = withPluginData(
        entries,
        field,
        ids.map((id) => remapExposedPropertyId(id, nodeId, propertyId))
      )
  }
  return entries
}
