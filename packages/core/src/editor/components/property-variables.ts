import { omit } from 'es-toolkit'

import {
  deleteInstanceOverride,
  cloneInstanceOverrideState,
  findComponentPropertyTargets,
  findInstanceAncestor,
  resolvedComponentPropertyValue,
  type ComponentPropertyDefinition,
  type SceneNode
} from '@open-pencil/scene-graph'

import { assertNodeEditable } from '#core/editor/capabilities'
import { applyDocumentChange, captureDocumentChange } from '#core/editor/history/document-change'
import type { EditorContext } from '#core/editor/types'
import { reconcileVariableLayouts } from '#core/layout/variables'

type Target = { instance: SceneNode; definition: ComponentPropertyDefinition }

export function createComponentPropertyVariableActions(
  ctx: EditorContext,
  resolve: (instanceId: string, propertyId: string) => Target | null
) {
  function applyVisibility(instance: SceneNode, definition: ComponentPropertyDefinition) {
    for (const { node, field } of findComponentPropertyTargets(
      ctx.graph,
      instance,
      definition.id
    )) {
      if (field !== 'VISIBLE') continue
      if (node.boundVariables.visible) ctx.graph.unbindVariable(node.id, 'visible')
      const nearest = findInstanceAncestor(ctx.graph, node.id)
      for (const owner of [instance, ...(nearest ? [nearest] : [])]) {
        const overrides = cloneInstanceOverrideState(owner.instanceOverrides)
        deleteInstanceOverride(overrides, owner.id, node.id, 'visible')
        ctx.graph.updateNode(owner.id, { instanceOverrides: overrides })
      }
      ctx.graph.updateNode(node.id, {
        visible: resolvedComponentPropertyValue(ctx.graph, instance, definition, node.id) === 'true'
      })
      ctx.runLayoutForNode(node.id)
    }
  }

  function change(
    instanceId: string,
    propertyId: string,
    source: { variableId: string } | { value: string } | null
  ): boolean {
    const target = resolve(instanceId, propertyId)
    if (target?.definition.type !== 'BOOLEAN') return false
    if (
      source &&
      'variableId' in source &&
      ctx.graph.variables.get(source.variableId)?.type !== 'BOOLEAN'
    )
      return false
    if (source && 'value' in source && !['true', 'false'].includes(source.value)) return false
    assertNodeEditable(ctx.graph, instanceId)
    assertNodeEditable(ctx.graph, target.instance.id)
    const { instance, definition } = target
    const finish = captureDocumentChange(ctx.graph, ctx.state.currentPageId)
    const assignments: Record<string, string> = omit(instance.componentPropertyAssignments, [
      definition.id
    ])
    const variables: Record<string, string> = omit(instance.componentPropertyVariableAssignments, [
      definition.id
    ])
    if (source && 'variableId' in source) variables[definition.id] = source.variableId
    if (source && 'value' in source) assignments[definition.id] = source.value
    ctx.graph.updateNode(instance.id, {
      componentPropertyAssignments: assignments,
      componentPropertyVariableAssignments: variables
    })
    applyVisibility(instance, definition)
    // An instance in a component is itself the default for its cloned occurrences.
    const component = ctx.graph.closest(instance.id, (node) => node.type === 'COMPONENT')
    if (component) ctx.graph.syncInstances(component.id)
    reconcileVariableLayouts(ctx.graph, { subtrees: [ctx.state.currentPageId] })
    const change = finish()
    const apply = (side: 'before' | 'after') => {
      applyDocumentChange(ctx.graph, change, side)
      for (const id of change.pageIds) ctx.runLayoutForNode(id)
      ctx.requestRender()
    }
    ctx.undo.push({
      label: source === null ? 'Reset component property' : 'Change component property binding',
      forward: () => apply('after'),
      inverse: () => apply('before')
    })
    ctx.requestRender()
    return true
  }
  return {
    setInstanceComponentPropertyVariable: (
      instanceId: string,
      propertyId: string,
      variableId: string
    ) => change(instanceId, propertyId, { variableId }),
    detachInstanceComponentPropertyVariable: (instanceId: string, propertyId: string) => {
      const target = resolve(instanceId, propertyId)
      return target
        ? change(instanceId, propertyId, {
            value: resolvedComponentPropertyValue(ctx.graph, target.instance, target.definition)
          })
        : false
    },
    resetInstanceComponentProperty: (instanceId: string, propertyId: string) =>
      change(instanceId, propertyId, null)
  }
}
