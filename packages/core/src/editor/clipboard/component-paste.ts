import {
  canCreateInstance,
  remapComponentPropertyPluginData,
  type SceneGraph,
  type SceneNode
} from '@open-pencil/scene-graph'

import type { ClipboardNodeTree } from './snapshot'

export function createPastedTrees(
  graph: SceneGraph,
  nodes: ClipboardNodeTree[],
  dependencies: ClipboardNodeTree[],
  pageId: string,
  targetId: string,
  reuseComponents: boolean,
  replacementTargets: SceneNode[] = []
) {
  const copiedIds = new Map<string, string>()
  const dependencyRootIds: string[] = []
  function createTree(source: ClipboardNodeTree, parentId: string, offset = 0): string {
    const { id: _id, childIds: _children, children = [], parentId: _parent, ...rest } = source
    const node = graph.createNode(source.type, parentId, {
      ...structuredClone(rest),
      x: source.x + offset,
      y: source.y + offset,
      childIds: []
    })
    copiedIds.set(source.id, node.id)
    for (const child of children) createTree(child, node.id)
    return node.id
  }
  function remapReferences() {
    for (const id of copiedIds.values()) {
      const node = graph.getNode(id)
      if (!node) continue
      graph.updateNode(id, {
        pluginData: remapComponentPropertyPluginData(
          node.pluginData,
          (id) => copiedIds.get(id) ?? id
        ),
        componentId: node.componentId
          ? (copiedIds.get(node.componentId) ?? node.componentId)
          : null,
        instanceOverrides: {
          self: node.instanceOverrides.self,
          descendants: new Map(
            [...node.instanceOverrides.descendants].map(([target, fields]) => [
              copiedIds.get(target) ?? target,
              fields
            ])
          )
        }
      })
    }
  }
  for (const dependency of dependencies) {
    if (!copiedIds.has(dependency.id)) dependencyRootIds.push(createTree(dependency, pageId))
  }
  const definitions = new Map<string, string>()
  for (const node of nodes) {
    if (node.type !== 'COMPONENT') continue
    let id = copiedIds.get(node.id)
    if (!id && reuseComponents && graph.getNode(node.id)?.type === 'COMPONENT') id = node.id
    if (!id) {
      id = createTree(node, pageId)
      dependencyRootIds.push(id)
    }
    definitions.set(node.id, id)
  }
  remapReferences()

  const references = new Set<string>(definitions.values())
  const visitedReferences = new Set<string>()
  function collectComponentReference(id: string) {
    if (visitedReferences.has(id)) return
    visitedReferences.add(id)
    const target = graph.getNode(copiedIds.get(id) ?? id)
    if (target?.type === 'COMPONENT') references.add(target.id)
    else if (target?.type === 'INSTANCE' && target.componentId)
      collectComponentReference(target.componentId)
  }
  function collectReferences(node: ClipboardNodeTree) {
    if (node.type === 'INSTANCE' && node.componentId) collectComponentReference(node.componentId)
    for (const child of node.children ?? []) collectReferences(child)
  }
  for (const node of nodes) collectReferences(node)
  let pasteTarget = targetId
  while ([...references].some((id) => !canCreateInstance(graph, id, pasteTarget))) {
    pasteTarget = graph.getNode(pasteTarget)?.parentId ?? pageId
    if (pasteTarget === pageId) break
  }
  const created: string[] = []
  function createRoot(node: ClipboardNodeTree) {
    const definition = definitions.get(node.id)
    if (definition && graph.getNode(pasteTarget)?.type === 'COMPONENT_SET') {
      const source = graph.getNode(definition)
      const sourceSet = source?.parentId ? graph.getNode(source.parentId) : undefined
      const id = createTree(node, pasteTarget, 20)
      // Properties inherited from a different set must travel with the copied variant.
      if (sourceSet?.type === 'COMPONENT_SET' && sourceSet.id !== pasteTarget) {
        const properties = new Map(
          sourceSet.componentPropertyDefinitions
            .filter((property) => property.type !== 'VARIANT')
            .map((property) => [property.id, property])
        )
        for (const property of node.componentPropertyDefinitions)
          properties.set(property.id, property)
        graph.updateNode(id, {
          componentPropertyDefinitions: structuredClone([...properties.values()])
        })
      }
      created.push(id)
    } else if (definition) {
      const instance = graph.createInstance(definition, pasteTarget, {
        x: node.x + 20,
        y: node.y + 20,
        rotation: node.rotation,
        flipX: node.flipX,
        flipY: node.flipY
      })
      if (instance) created.push(instance.id)
    } else {
      created.push(createTree(node, pasteTarget, 20))
    }
  }
  for (const node of nodes) createRoot(node)
  remapReferences()
  const canReplace = replacementTargets.every(
    (target) =>
      target.parentId === pasteTarget &&
      [...references].every((id) => canCreateInstance(graph, id, target.id))
  )
  return { created, dependencyRootIds, pasteTarget, canReplace }
}
