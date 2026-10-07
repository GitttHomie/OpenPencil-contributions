import {
  getInstanceOverride,
  nestedPropertyId,
  OPEN_PENCIL_PLUGIN_DATA,
  readPluginData,
  withPluginData
} from '@open-pencil/scene-graph'
import type { ComponentPropertyDefinition, SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { assertNodeEditable } from '#core/editor/capabilities'
import type { EditorContext } from '#core/editor/types'

import { componentAuthoringContext, componentBindingNodes } from './authoring/context'
import { reorderPropertyDefinitions } from './variants/order'

type Definitions = (instanceId: string) => ComponentPropertyDefinition[]

export interface NestedComponentProperty {
  id: string
  name: string
  sourceId: string
  instance: SceneNode
  definition: ComponentPropertyDefinition
}

function exposedProperties(node: SceneNode): string[] {
  return readPluginData(node.pluginData, OPEN_PENCIL_PLUGIN_DATA.exposedComponentProperties) ?? []
}

function exposureSource(graph: SceneGraph, node: SceneNode): SceneNode {
  const visited = new Set<string>()
  let source = node
  while (source.componentId && !visited.has(source.id)) {
    visited.add(source.id)
    const owner = source.parentId
      ? graph.closest(source.parentId, (node) => node.type === 'INSTANCE')
      : undefined
    const mapped = owner
      ? getInstanceOverride(owner.instanceOverrides, owner.id, source.id, 'sourceComponentId')
      : undefined
    const parentSource = graph.getNode(typeof mapped === 'string' ? mapped : source.componentId)
    if (parentSource?.type !== 'INSTANCE') break
    source = parentSource
  }
  return source
}

/** Match occurrence children to the exact nested source, including repeated component instances. */
export function nestedComponentProperties(
  graph: SceneGraph,
  instance: SceneNode,
  definitions: Definitions
): NestedComponentProperty[] {
  const result: NestedComponentProperty[] = []
  const visited = new Set<string>()
  function visit(parent: SceneNode) {
    if (visited.has(parent.id)) return
    visited.add(parent.id)
    for (const child of graph.getChildren(parent.id)) {
      if (child.type !== 'INSTANCE') {
        visit(child)
        continue
      }
      const mapped = getInstanceOverride(
        instance.instanceOverrides,
        instance.id,
        child.id,
        'sourceComponentId'
      )
      const sourceId = typeof mapped === 'string' ? mapped : child.componentId
      const source = sourceId ? graph.getNode(sourceId) : undefined
      if (source?.type !== 'INSTANCE') continue
      const original = exposureSource(graph, source)
      const exposed = new Set(exposedProperties(original))
      if (!exposed.size) continue
      for (const definition of definitions(child.id)) {
        if (!exposed.has(definition.id) || definition.type === 'SLOT') continue
        result.push({
          id: nestedPropertyId(original.id, definition.id),
          name: `${original.name} / ${definition.name}`,
          sourceId: source.id,
          instance: child,
          definition
        })
      }
    }
  }
  visit(instance)
  return result
}

export function createNestedPropertyActions(ctx: EditorContext, definitions: Definitions) {
  function getNestedComponentPropertyCandidates(ownerId: string) {
    const owner = ctx.graph.getNode(ownerId)
    if (owner?.type !== 'COMPONENT' && owner?.type !== 'COMPONENT_SET') return []
    return componentBindingNodes(ctx.graph, ownerId)
      .filter((node) => node.type === 'INSTANCE')
      .map((node) => {
        const variant = ctx.graph.closest(node.id, (node) => node.type === 'COMPONENT')
        const properties = definitions(node.id).filter((definition) => definition.type !== 'SLOT')
        return {
          id: node.id,
          name:
            owner.type === 'COMPONENT_SET' && variant
              ? `${variant.name} / ${node.name}`
              : node.name,
          properties,
          exposed: exposedProperties(node).filter((id) => properties.some((item) => item.id === id))
        }
      })
  }

  function setNestedComponentPropertyExposure(
    ownerId: string,
    nodeId: string,
    propertyIds: string[]
  ) {
    const context = componentAuthoringContext(ctx.graph, nodeId)
    if (
      context?.node.type !== 'INSTANCE' ||
      (context.owner.id !== ownerId && context.component.id !== ownerId)
    )
      return false
    assertNodeEditable(ctx.graph, ownerId)
    assertNodeEditable(ctx.graph, nodeId)
    const available = new Set(
      definitions(nodeId)
        .filter((item) => item.type !== 'SLOT')
        .map((item) => item.id)
    )
    if (propertyIds.some((id) => !available.has(id))) return false
    const before = exposedProperties(context.node)
    const after = [...new Set(propertyIds)]
    if (before.length === after.length && before.every((id, index) => id === after[index]))
      return true
    const apply = (ids: string[]) => {
      const node = ctx.graph.getNode(nodeId)
      if (!node) return
      ctx.graph.updateNode(nodeId, {
        pluginData: withPluginData(
          node.pluginData,
          OPEN_PENCIL_PLUGIN_DATA.exposedComponentProperties,
          ids.length ? ids : undefined
        )
      })
      ctx.requestRender()
    }
    ctx.undo.execute({
      label: 'Expose nested component properties',
      forward: () => apply(after),
      inverse: () => apply(before)
    })
    return true
  }
  function reorderExposedComponentProperties(ownerId: string, propertyIds: string[]) {
    const owner = ctx.graph.getNode(ownerId)
    if (owner?.type !== 'COMPONENT' && owner?.type !== 'COMPONENT_SET') return false
    assertNodeEditable(ctx.graph, ownerId)
    const scopes =
      owner.type === 'COMPONENT_SET'
        ? [owner, ...ctx.graph.getChildren(ownerId).filter((node) => node.type === 'COMPONENT')]
        : [owner]
    const available = new Set([
      ...scopes.flatMap((node) =>
        node.componentPropertyDefinitions
          .filter((definition) => definition.type !== 'VARIANT' && definition.type !== 'SLOT')
          .map((definition) => definition.id)
      ),
      ...getNestedComponentPropertyCandidates(ownerId).flatMap((candidate) =>
        candidate.exposed.map((id) => nestedPropertyId(candidate.id, id))
      )
    ])
    if (
      new Set(propertyIds).size !== available.size ||
      propertyIds.length !== available.size ||
      propertyIds.some((id) => !available.has(id))
    )
      return false
    const field = OPEN_PENCIL_PLUGIN_DATA.componentPropertyOrder
    const before = readPluginData(owner.pluginData, field)
    const apply = (ids: string[] | undefined) => {
      const live = ctx.graph.getNode(ownerId)
      if (!live) return
      ctx.graph.updateNode(ownerId, { pluginData: withPluginData(live.pluginData, field, ids) })
      ctx.requestRender()
    }
    ctx.undo.runBatch('Reorder component properties', () => {
      for (const scope of scopes) {
        const own = new Set(scope.componentPropertyDefinitions.map((definition) => definition.id))
        reorderPropertyDefinitions(
          ctx,
          scope.id,
          propertyIds.filter((id) => own.has(id))
        )
      }
      ctx.undo.execute({
        label: 'Reorder component properties',
        forward: () => apply(propertyIds),
        inverse: () => apply(before)
      })
    })
    return true
  }
  return {
    getNestedComponentPropertyCandidates,
    setNestedComponentPropertyExposure,
    reorderExposedComponentProperties
  }
}
