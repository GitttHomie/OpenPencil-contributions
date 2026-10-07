import { pick } from 'es-toolkit'

import {
  cloneInstanceOverrideState,
  findInstanceAncestor,
  independentNumberGroup,
  sharedNumberGroup,
  recordInstanceOverride,
  hasInstanceOverride,
  setInstanceOverride,
  type SceneNode
} from '@open-pencil/scene-graph'

import type { EditorContext } from './types'

export function createNumericPropertyGroupActions(ctx: EditorContext) {
  function prepareNumberProperty(nodeId: string, path: string) {
    const node = ctx.graph.getNode(nodeId)
    const group = node && sharedNumberGroup(node, path)
    if (!node || !group) return
    const changes = independentNumberGroup(node, group)
    const before = structuredClone(pick(node, Object.keys(changes) as (keyof SceneNode)[]))
    const owner = findInstanceAncestor(ctx.graph, nodeId)
    const previousOverrides = owner && cloneInstanceOverrideState(owner.instanceOverrides)
    const sharedValueOverridden = hasInstanceOverride(ctx.graph, nodeId, group.shared)
    const sharedBindingOverridden = hasInstanceOverride(
      ctx.graph,
      nodeId,
      `boundVariables/${group.shared}`
    )
    const apply = () => {
      ctx.graph.updateNode(nodeId, structuredClone(changes))
      // Conversion is representational: untouched sides must continue following the definition.
      recordInstanceOverride(ctx.graph, nodeId, [
        group.independent,
        ...(sharedValueOverridden ? group.paths : [])
      ])
      if (owner && sharedBindingOverridden) {
        for (const side of group.paths) {
          setInstanceOverride(
            owner.instanceOverrides,
            owner.id,
            nodeId,
            `boundVariables/${side}`,
            node.boundVariables[side] ?? null
          )
        }
        ctx.graph.updateNode(owner.id, {
          instanceOverrides: cloneInstanceOverrideState(owner.instanceOverrides)
        })
      }
      ctx.runLayoutForNode(nodeId)
      ctx.requestRender()
    }
    apply()
    ctx.undo.push({
      label: 'Edit individual values',
      forward: apply,
      inverse: () => {
        ctx.graph.updateNode(nodeId, structuredClone(before))
        if (owner && previousOverrides) {
          ctx.graph.updateNode(owner.id, {
            instanceOverrides: cloneInstanceOverrideState(previousOverrides)
          })
        }
        ctx.runLayoutForNode(nodeId)
        ctx.requestRender()
      }
    })
  }
  return { prepareNumberProperty }
}
