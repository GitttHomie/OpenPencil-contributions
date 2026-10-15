import {
  cloneInstanceOverrideState,
  deleteInstanceOverride,
  setInstanceOverride,
  findInstanceAncestor,
  variableBindingOwner,
  isNumericVariableBindingField,
  type SceneNode
} from '@open-pencil/scene-graph'

import { reconcileVariableLayouts } from '#core/layout/variables'

import type { EditorContext } from './types'
import { loadBoundFonts } from './typography/bound-fonts'

export function createVariableBindingActions(ctx: EditorContext) {
  /** A binding change reaches only the layer it is on and the layers inside it. */
  function refreshBindings(nodeId: string) {
    loadBoundFonts(ctx, reconcileVariableLayouts(ctx.graph, { subtrees: [nodeId] }))
    ctx.requestRender()
  }

  function changeBinding(nodeId: string, path: string, variableId?: string) {
    const node = ctx.graph.getNode(nodeId)
    if (!node || (variableId === undefined && !(path in node.boundVariables))) return
    const previous: Pick<SceneNode, 'boundVariables' | 'variableBindingScales'> &
      Partial<SceneNode> = {
      boundVariables: { ...node.boundVariables },
      variableBindingScales: { ...node.variableBindingScales },
      fontFamily: node.fontFamily,
      fontWeight: node.fontWeight,
      textStyleId: node.textStyleId
    }
    if (path === 'visible') previous.visible = node.visible
    else if (isNumericVariableBindingField(path))
      Object.assign(previous, { [path]: node[path as keyof SceneNode] })
    const owner = variableBindingOwner(ctx.graph, node)
    const nearest = findInstanceAncestor(ctx.graph, nodeId)
    const owners = new Map(
      [owner, ...(nearest ? [nearest] : [])].map(
        (item) => [item.id, cloneInstanceOverrideState(item.instanceOverrides)] as const
      )
    )
    const apply = () => {
      if (variableId === undefined) {
        ctx.graph.unbindVariable(nodeId, path)
        if (
          path === 'visible' &&
          nearest?.componentId &&
          node.componentPropertyReferences.some((reference) => reference.field === 'VISIBLE')
        ) {
          ctx.graph.syncInstance(nearest.id)
        } else if (path === 'visible') {
          for (const id of owners.keys()) {
            const instance = ctx.graph.getNode(id)
            if (instance?.type !== 'INSTANCE') continue
            ctx.graph.willChangeNode(instance)
            setInstanceOverride(
              instance.instanceOverrides,
              instance.id,
              nodeId,
              'visible',
              node.visible
            )
          }
        }
      } else {
        ctx.graph.bindVariable(nodeId, path, variableId)
        if (path === 'visible') {
          for (const id of owners.keys()) {
            const instance = ctx.graph.getNode(id)
            if (instance?.type !== 'INSTANCE') continue
            ctx.graph.willChangeNode(instance)
            deleteInstanceOverride(instance.instanceOverrides, instance.id, nodeId, 'visible')
          }
        }
      }
      refreshBindings(nodeId)
    }
    apply()
    ctx.undo.push({
      label: variableId === undefined ? 'Unbind variable' : 'Bind variable',
      forward: () => {
        try {
          apply()
        } catch (error) {
          console.warn(
            'Redo variable binding failed:',
            error instanceof Error ? error.message : String(error)
          )
        }
      },
      inverse: () => {
        for (const [id, state] of owners) {
          ctx.graph.updateNode(id, { instanceOverrides: cloneInstanceOverrideState(state) })
        }
        const restored = structuredClone(previous)
        restored.boundVariables = Object.fromEntries(
          Object.entries(restored.boundVariables).filter(([, id]) => ctx.graph.variables.has(id))
        )
        restored.variableBindingScales = Object.fromEntries(
          Object.entries(restored.variableBindingScales).filter(
            ([field]) => field in restored.boundVariables
          )
        )
        ctx.graph.updateNode(nodeId, restored)
        refreshBindings(nodeId)
      }
    })
  }

  return {
    bindVariable: (nodeId: string, path: string, variableId: string) =>
      changeBinding(nodeId, path, variableId),
    unbindVariable: (nodeId: string, path: string) => changeBinding(nodeId, path)
  }
}
