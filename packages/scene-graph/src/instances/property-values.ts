import type { ComponentPropertyReferenceField, SceneGraph, SceneNode } from '../'
import { instanceMainComponent, instancePropertyAssignment } from './main-component'

/** SLOT_CONTENT is absent because it drives children, which `ownsSlotContent` keeps instead. */
const PROPERTY_REFERENCE_FIELDS: Partial<Record<ComponentPropertyReferenceField, string>> = {
  VISIBLE: 'visible',
  TEXT: 'text',
  INSTANCE_SWAP: 'componentId'
}

/** Instance links are expected to be shallow; the cap only stops a cycle from hanging sync. */
const INSTANCE_CHAIN_LIMIT = 16

/**
 * Whether this instance's component, or the set it is a variant of, is where `propertyId` is
 * defined. Only a set counts: a component nested in an ordinary component defines its own
 * properties, not the outer one's.
 */
function definesProperty(graph: SceneGraph, instance: SceneNode, propertyId: string): boolean {
  // An instance of an instance links through to the component, so follow the chain to it.
  let component = instance.componentId ? graph.nodes.get(instance.componentId) : undefined
  for (let hops = 0; component?.type === 'INSTANCE' && hops < INSTANCE_CHAIN_LIMIT; hops++) {
    component = component.componentId ? graph.nodes.get(component.componentId) : undefined
  }
  const parent = component?.parentId ? graph.nodes.get(component.parentId) : undefined
  const set = parent?.type === 'COMPONENT_SET' ? parent : undefined
  return [component, set]
    .flatMap((node) => node?.componentPropertyDefinitions ?? [])
    .some((definition) => definition.id === propertyId)
}

/**
 * What the nearest enclosing instance assigns `propertyId`, if any does. A property id belongs
 * to the component that defines it, so the walk stops at an instance of that component even
 * when it assigns nothing; otherwise an outer instance's unrelated property of the same id wins.
 */
export function enclosingAssignment(
  graph: SceneGraph,
  node: SceneNode,
  propertyId: string
): string | undefined {
  let current: SceneNode | undefined = node
  while (current) {
    if (current.type === 'INSTANCE') {
      const value = instancePropertyAssignment(graph, current, propertyId)
      if (value !== undefined) return value
      if (definesProperty(graph, current, propertyId)) return undefined
    }
    current = current.parentId ? graph.nodes.get(current.parentId) : undefined
  }
  return undefined
}

function hasEnclosingAssignment(graph: SceneGraph, node: SceneNode, propertyId: string): boolean {
  return enclosingAssignment(graph, node, propertyId) !== undefined
}

/**
 * A component can gain a property-driven layer after an instance of it exists. Pass 4 leaves a
 * driven field alone, so the fresh clone has to take the enclosing instance's assignment here or
 * it keeps the component's default while every other instance layer shows the assigned value.
 */
export function applyEnclosingAssignments(graph: SceneGraph, clone: SceneNode): void {
  for (const reference of clone.componentPropertyReferences) {
    const field = PROPERTY_REFERENCE_FIELDS[reference.field]
    if (!field) continue
    const value = enclosingAssignment(graph, clone, reference.propertyId)
    if (value === undefined) continue
    if (field === 'visible' && clone.visible !== (value === 'true'))
      graph.updateNode(clone.id, { visible: value === 'true' })
    else if (field === 'text' && clone.text !== value) graph.updateNode(clone.id, { text: value })
    else if (
      field === 'componentId' &&
      clone.type === 'INSTANCE' &&
      graph.nodes.has(value) &&
      instanceMainComponent(graph, clone)?.id !== value
    ) {
      graph.swapInstanceComponent(clone.id, value)
    }
  }
  for (const child of graph.getChildren(clone.id)) applyEnclosingAssignments(graph, child)
}

/**
 * Fields a component property drives on this child. The component states the default, but
 * an enclosing instance's assignment decides the value, so synchronising must not copy the
 * default over it — a page loaded later would otherwise reset the instance to the default.
 */
export function propertyDrivenFields(
  graph: SceneGraph,
  instChild: SceneNode,
  compChild: SceneNode
): Set<string> {
  const driven = new Set<string>()
  for (const reference of compChild.componentPropertyReferences) {
    const field = PROPERTY_REFERENCE_FIELDS[reference.field]
    if (field && hasEnclosingAssignment(graph, instChild, reference.propertyId)) driven.add(field)
  }
  return driven
}
