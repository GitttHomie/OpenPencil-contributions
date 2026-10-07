import {
  cloneInstanceOverrideState,
  deleteInstanceOverride,
  getInstanceOverride,
  instanceMainComponent
} from '@open-pencil/scene-graph'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

/** All enclosing instances can hold a size claim for a nested occurrence. */
export function variantInstanceOwners(graph: SceneGraph, instance: SceneNode): SceneNode[] {
  const owners: SceneNode[] = []
  const seen = new Set([instance.id])
  let parentId = instance.parentId
  while (parentId) {
    const owner = graph.closest(parentId, (node) => node.type === 'INSTANCE')
    if (!owner || seen.has(owner.id)) break
    seen.add(owner.id)
    owners.push(owner)
    parentId = owner.parentId
  }
  return owners
}

/**
 * Old saved instances can claim the source's unchanged size, including after a
 * previous variant switch. Such claims must not pin the next variant's dimensions.
 * Distinct custom sizes and explicitly edited/bound dimensions retain their claims.
 */
export function releaseInheritedVariantSize(
  graph: SceneGraph,
  instance: SceneNode,
  component: SceneNode,
  owners: SceneNode[]
): void {
  const sources = [component]
  const seen = new Set([instance.id])
  let current = instance
  while (current.type === 'INSTANCE') {
    const owner = variantInstanceOwners(graph, current).at(0)
    const mapped = owner
      ? getInstanceOverride(owner.instanceOverrides, owner.id, current.id, 'sourceComponentId')
      : undefined
    const sourceId = typeof mapped === 'string' ? mapped : current.componentId
    const source = sourceId ? graph.getNode(sourceId) : undefined
    if (!source || seen.has(source.id)) break
    seen.add(source.id)
    if (source.type === 'INSTANCE') sources.push(source)
    current = source
  }
  const fields = (['width', 'height'] as const).filter((axis) => {
    if (instance.boundVariables[axis]) return false
    if (
      instance.instanceOverrides.self.get(axis) === true &&
      instance.source.editedFields.includes(axis)
    )
      return false
    const value = instance[axis] / instance.componentScale
    return sources.some((source) => {
      const main = source.type === 'INSTANCE' ? instanceMainComponent(graph, source) : source
      if (!main || main.parentId !== component.parentId) return false
      const intrinsic = main[axis] / main.componentScale
      return value === intrinsic && source[axis] / source.componentScale === intrinsic
    })
  })
  if (!fields.length) return
  for (const owner of [instance, ...owners]) {
    const overrides = cloneInstanceOverrideState(owner.instanceOverrides)
    let changed = false
    for (const field of fields) {
      if (deleteInstanceOverride(overrides, owner.id, instance.id, field)) changed = true
    }
    if (changed) graph.updateNode(owner.id, { instanceOverrides: overrides })
  }
}
