import type { SceneGraph } from '../index'
import { getInstanceOverride } from '../instance-overrides'
import { instanceMainComponent } from '../instances/main-component'
import type { SceneNode } from '../types'
import type { GraphTransferPlan } from './apply'
import { semanticTransferReferences } from './nodes'

/** These children disappear with the definition edit; they are not independent consumers. */
function generatedTransferChildren(graph: SceneGraph, transferred: ReadonlySet<string>) {
  const generated = new Set<string>()
  for (const node of graph.getAllNodes()) {
    if (transferred.has(node.id) || !node.parentId) continue
    let parentId: string | null = node.parentId
    const visited = new Set<string>()
    while (parentId) {
      const owner = graph.closest(parentId, (candidate) => candidate.type === 'INSTANCE')
      if (!owner || visited.has(owner.id)) break
      visited.add(owner.id)
      const mapped = getInstanceOverride(
        owner.instanceOverrides,
        owner.id,
        node.id,
        'sourceComponentId'
      )
      const sourceId = typeof mapped === 'string' ? mapped : node.componentId
      const component = instanceMainComponent(graph, owner)
      if (
        sourceId &&
        transferred.has(sourceId) &&
        component &&
        !transferred.has(component.id) &&
        graph.isDescendant(sourceId, component.id)
      ) {
        generated.add(node.id)
        break
      }
      parentId = owner.parentId
    }
  }
  return generated
}

function independentOverrides(node: SceneNode, generated: ReadonlySet<string>) {
  const current = node.instanceOverrides
  const descendants = new Map([...current.descendants].filter(([id]) => !generated.has(id)))
  return descendants.size === current.descendants.size ? current : { ...current, descendants }
}

function independentReferences(node: SceneNode, generated: ReadonlySet<string>): string[] {
  if (generated.has(node.id)) return []
  return semanticTransferReferences({
    ...node,
    instanceOverrides: independentOverrides(node, generated)
  })
}

/** Refuse to remove transferred content that has acquired external dependents. */
export function removeGraphTransfer(graph: SceneGraph, plan: GraphTransferPlan): void {
  const nodes = new Set(plan.nodes.map((node) => node.id))
  const generated = generatedTransferChildren(graph, nodes)
  const variables = new Set(plan.variables.map((variable) => variable.id))
  const collections = new Set(plan.collections.map((collection) => collection.id))
  const referencesOwned = (value: unknown): boolean => {
    if (typeof value === 'string')
      return (
        nodes.has(value) || generated.has(value) || variables.has(value) || collections.has(value)
      )
    if (!value || typeof value !== 'object' || ArrayBuffer.isView(value)) return false
    if (value instanceof Map)
      return [...value].some(([key, item]) => referencesOwned(key) || referencesOwned(item))
    return Object.values(value).some(referencesOwned)
  }
  for (const node of graph.getAllNodes()) {
    if (nodes.has(node.id)) {
      if (node.childIds.some((id) => !nodes.has(id)))
        throw new Error('Transferred node has non-owned children')
      continue
    }
    if (independentReferences(node, generated).some(referencesOwned))
      throw new Error(`Transferred content is referenced by ${node.id}`)
  }
  for (const variable of graph.variables.values()) {
    if (!variables.has(variable.id) && referencesOwned(variable.valuesByMode))
      throw new Error('Transferred variable has external aliases')
  }
  graph.withBufferedEvents(() => {
    // Prune the derived occurrences and their correspondence before removing the source.
    for (const node of graph.getAllNodes()) {
      const instanceOverrides = independentOverrides(node, generated)
      if (instanceOverrides !== node.instanceOverrides)
        graph.updateNode(node.id, { instanceOverrides })
    }
    for (const id of [...generated].reverse()) graph.deleteNode(id)
    for (const node of plan.nodes.toReversed()) graph.deleteNode(node.id)
    for (const id of variables) graph.variables.delete(id)
    for (const id of collections) {
      graph.variableCollections.delete(id)
      graph.activeMode.delete(id)
    }
  })
}
