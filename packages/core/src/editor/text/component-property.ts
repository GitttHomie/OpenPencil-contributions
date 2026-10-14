import {
  cloneInstanceOverrideState,
  componentPropertyDefinitions,
  findComponentPropertyTargets,
  type SceneGraph
} from '@open-pencil/scene-graph'
import { copyStyleRuns } from '@open-pencil/scene-graph/copy'

import { componentPropertyEditTarget } from '#core/editor/components/authoring/binding'
import { applyInstancePropertyValue } from '#core/editor/components/properties'
import type { EditorContext } from '#core/editor/types'
import { textAutoResizeChanges } from '#core/layout/text-auto-resize'

import { createTextEditSession } from './session'

export function instanceTextProperty(graph: SceneGraph, nodeId: string) {
  const target = componentPropertyEditTarget(graph, nodeId, 'TEXT')
  if (target?.kind !== 'override') return null
  const instance = graph.getNode(target.nodeId)
  if (instance?.type !== 'INSTANCE') return null
  const definition = componentPropertyDefinitions(graph, instance).find(
    (item) => item.id === target.propertyId && item.type === 'TEXT'
  )
  return definition ? { instance, definition } : null
}

export function updateInstanceTextProperty(ctx: EditorContext, nodeId: string, value: string) {
  const property = instanceTextProperty(ctx.graph, nodeId)
  if (!property) return false
  return applyInstancePropertyValue(ctx.graph, property.instance.id, property.definition, value)
}

/** One history entry for a live attribute edit, including all layers bound to it. */
export function createInstanceTextPropertyEdit(ctx: EditorContext, nodeId: string) {
  const property = instanceTextProperty(ctx.graph, nodeId)
  if (!property) return null
  const { instance, definition } = property
  const nodeIds = findComponentPropertyTargets(ctx.graph, instance, definition.id)
    .filter((target) => target.field === 'TEXT')
    .map((target) => target.node.id)

  function snapshot() {
    const live = ctx.graph.getNode(instance.id) ?? instance
    return {
      assignments: { ...live.componentPropertyAssignments },
      overrides: cloneInstanceOverrideState(live.instanceOverrides),
      nodes: nodeIds.flatMap((id) => {
        const node = ctx.graph.getNode(id)
        return node ? [createTextEditSession(node)] : []
      })
    }
  }

  function restore(state: ReturnType<typeof snapshot>) {
    if (!ctx.graph.getNode(instance.id)) return
    for (const node of state.nodes) {
      const live = ctx.graph.getNode(node.nodeId)
      if (!live) continue
      const changes = {
        text: node.before.text,
        styleRuns: copyStyleRuns(node.before.styleRuns),
        ...node.before.size
      }
      ctx.graph.updateNode(node.nodeId, {
        ...textAutoResizeChanges(live, changes),
        ...changes,
        ...structuredClone(node.beforePathText)
      })
    }
    ctx.graph.updateNode(instance.id, {
      componentPropertyAssignments: { ...state.assignments },
      instanceOverrides: cloneInstanceOverrideState(state.overrides)
    })
    ctx.runLayoutForNode(instance.id)
    ctx.requestRender()
  }

  const before = snapshot()
  let updated = false
  return {
    update(value: string) {
      updated = true
      return updateInstanceTextProperty(ctx, nodeId, value)
    },
    restore() {
      if (updated) restore(before)
    },
    commit() {
      const after = snapshot()
      ctx.undo.push({
        label: 'Edit text',
        forward: () => restore(after),
        inverse: () => restore(before)
      })
    }
  }
}
