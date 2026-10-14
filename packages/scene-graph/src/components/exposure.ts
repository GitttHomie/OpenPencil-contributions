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

import type { SceneGraph } from '../index'
import { instanceMainComponent } from '../instances/main-component'
import { walkInstanceSources } from '../instances/source-walk'
import { componentPropertyDefinitions } from './properties'

/**
 * Instances a component can expose: those in its own layers, not inside another instance,
 * whose content belongs to that instance's component.
 */
export function exposableInstances(graph: SceneGraph, componentId: string): SceneNode[] {
  const found: SceneNode[] = []
  const visit = (parentId: string): void => {
    for (const child of graph.getChildren(parentId)) {
      if (child.type === 'INSTANCE') found.push(child)
      else visit(child.id)
    }
  }
  visit(componentId)
  return found
}

/**
 * The layers of an instance that stand for exposed nested instances of its component, in
 * layer order. Each is matched to its source the way instance sync matches children.
 */
export function exposedInstances(graph: SceneGraph, instance: SceneNode): SceneNode[] {
  const found: SceneNode[] = []
  walkInstanceSources(graph, instance, (source, target) => {
    if (source.type !== 'INSTANCE') return true
    if (source.isExposedInstance) found.push(target)
    return false
  })
  return found
}

const OWNER_TYPES = new Set<SceneNode['type']>(['INSTANCE', 'COMPONENT', 'COMPONENT_SET'])

/** Why Figma refuses to expose an instance, or null when it may be exposed. */
export type InstanceExposureIssue = 'not-in-component' | 'not-primary' | 'nothing-to-expose'

/**
 * Whether an instance may be exposed, under Figma's rules: it sits in a component's own layers
 * (an instance's copy follows its source) and its component has properties or exposes nested
 * instances itself.
 */
export function instanceExposureIssue(
  graph: SceneGraph,
  instance: SceneNode
): InstanceExposureIssue | null {
  const owner = instance.parentId
    ? graph.closest(instance.parentId, (node) => OWNER_TYPES.has(node.type))
    : undefined
  if (!owner) return 'not-in-component'
  if (owner.type === 'INSTANCE') return 'not-primary'
  const component = instanceMainComponent(graph, instance)
  const exposes =
    componentPropertyDefinitions(graph, instance).length > 0 ||
    (!!component && exposableInstances(graph, component.id).some((node) => node.isExposedInstance))
  return exposes ? null : 'nothing-to-expose'
}
