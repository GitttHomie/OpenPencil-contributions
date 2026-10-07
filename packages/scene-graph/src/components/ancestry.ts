import type { SceneGraph } from '../index'

/** Whether a layer is a component, instance, set, or one of their descendants. */
export function isInComponent(graph: SceneGraph, nodeId: string): boolean {
  return (
    graph.closest(
      nodeId,
      (node) =>
        node.type === 'COMPONENT' || node.type === 'COMPONENT_SET' || node.type === 'INSTANCE'
    ) !== undefined
  )
}
