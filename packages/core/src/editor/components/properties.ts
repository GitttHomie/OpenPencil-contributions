import {
  applyComponentPropertyValue,
  cloneInstanceOverrideState,
  deleteInstanceOverride,
  componentPropertyDefinitions,
  componentPropertyOwners,
  orderComponentProperties,
  findComponentPropertyTargets,
  instanceMainComponent,
  instancePropertyAssignment,
  resolveComponentPropertyValue,
  setInstanceOverride
} from '@open-pencil/scene-graph'
import type {
  ComponentPropertyDefinition,
  ComponentPropertyTarget,
  SceneNode,
  SceneGraph
} from '@open-pencil/scene-graph'

import { assertNodeEditable } from '#core/editor/capabilities'
import { textAutoResizeChanges } from '#core/editor/text/auto-resize'
import { pathTextEditChanges } from '#core/editor/text/path-edit'
import type { EditorContext } from '#core/editor/types'
import { invalidateDerivedLayout } from '#core/layout/derived'

import { nestedComponentProperties } from './nested-properties'

function definitionsForInstance(
  ctx: Pick<EditorContext, 'graph'>,
  instance: SceneNode
): ComponentPropertyDefinition[] {
  return componentPropertyDefinitions(ctx.graph, instance)
}

function swapTargetId(ctx: Pick<EditorContext, 'graph'>, value: string): string | null {
  return resolveComponentPropertyValue(ctx.graph, value)?.id ?? null
}

function targetValue(target: ComponentPropertyTarget | null): string {
  if (!target) return ''
  if (target.field === 'TEXT') return target.node.text
  if (target.field === 'VISIBLE') return String(target.node.visible)
  return target.source.componentId ?? target.node.componentId ?? ''
}
function applyPropertyValue(
  ctx: Pick<EditorContext, 'graph'>,
  instanceId: string,
  definition: ComponentPropertyDefinition,
  value: string
): boolean {
  const result = applyComponentPropertyValue(ctx.graph, instanceId, definition, value)
  return definition.type !== 'INSTANCE_SWAP' || result !== null
}

/** Shared mutation for editor controls and agent tools; history belongs to the caller. */
export function applyInstancePropertyValue(
  graph: SceneGraph,
  instanceId: string,
  definition: ComponentPropertyDefinition,
  value: string,
  inherited = false
): boolean {
  const instance = graph.getNode(instanceId)
  if (instance?.type !== 'INSTANCE') return false
  const targets = findComponentPropertyTargets(graph, instance, definition.id)
  const visibilityChanges = targets.filter(
    ({ node, field }) => field === 'VISIBLE' && node.visible !== (value === 'true')
  )
  if (!applyPropertyValue({ graph }, instanceId, definition, value)) return false
  for (const { node } of visibilityChanges) invalidateDerivedLayout(graph, node.id)
  if (inherited) {
    for (const target of targets) {
      const fields = {
        TEXT: ['text'],
        VISIBLE: ['visible'],
        INSTANCE_SWAP: ['componentId', 'name'],
        SLOT_CONTENT: []
      } as const
      for (const field of fields[target.field])
        deleteInstanceOverride(instance.instanceOverrides, instance.id, target.node.id, field)
    }
    graph.updateNode(instanceId, {
      componentPropertyAssignments: Object.fromEntries(
        Object.entries(instance.componentPropertyAssignments).filter(([id]) => id !== definition.id)
      ),
      instanceOverrides: cloneInstanceOverrideState(instance.instanceOverrides)
    })
  }
  for (const { node, field } of targets) {
    if (field !== 'TEXT' || node.type !== 'TEXT') continue
    const changes = { text: node.text }
    graph.updateNode(node.id, {
      ...textAutoResizeChanges(node, changes),
      ...pathTextEditChanges(node, changes)
    })
  }
  return true
}

export function reapplyInstanceComponentProperties(
  ctx: Pick<EditorContext, 'graph'>,
  instanceId: string
): void {
  const instance = ctx.graph.getNode(instanceId)
  if (instance?.type !== 'INSTANCE') return
  const definitions = new Map(
    definitionsForInstance(ctx, instance).map((definition) => [definition.id, definition])
  )
  for (const definition of definitions.values()) {
    const value = instancePropertyAssignment(ctx.graph, instance, definition.id)
    if (value !== undefined && definition.type !== 'VARIANT') {
      applyInstancePropertyValue(
        ctx.graph,
        instanceId,
        definition,
        value,
        !Object.hasOwn(instance.componentPropertyAssignments, definition.id)
      )
    }
  }
}

export function createComponentPropertyActions(
  ctx: EditorContext,
  switchVariant: (instanceId: string, propertyName: string, newValue: string) => void
) {
  function refreshPropertyLayout(instanceId: string, definition: ComponentPropertyDefinition) {
    const instance = ctx.graph.getNode(instanceId)
    if (!instance) return
    if (definition.type === 'TEXT') {
      for (const { node, field } of findComponentPropertyTargets(
        ctx.graph,
        instance,
        definition.id
      )) {
        if (field !== 'TEXT' || node.type !== 'TEXT') continue
        const changes = { text: node.text }
        ctx.graph.updateNode(node.id, {
          ...textAutoResizeChanges(node, changes),
          ...pathTextEditChanges(node, changes)
        })
      }
    }
    ctx.runLayoutForNode(instanceId)
  }

  function getInstanceComponentPropertyDefinitions(
    instanceId: string
  ): ComponentPropertyDefinition[] {
    const instance = ctx.graph.getNode(instanceId)
    if (instance?.type !== 'INSTANCE') return []
    const component = instanceMainComponent(ctx.graph, instance)
    const inSet =
      component?.parentId && ctx.graph.getNode(component.parentId)?.type === 'COMPONENT_SET'
    const own = definitionsForInstance(ctx, instance).filter(
      (definition) =>
        !inSet ||
        definition.type === 'VARIANT' ||
        definition.type === 'SLOT' ||
        findComponentPropertyTargets(ctx.graph, instance, definition.id).length > 0
    )
    return orderComponentProperties(
      [
        ...own,
        ...nestedComponentProperties(
          ctx.graph,
          instance,
          getInstanceComponentPropertyDefinitions
        ).map(({ id, name, definition }) => ({ ...definition, id, name }))
      ],
      componentPropertyOwners(ctx.graph, instance)
    )
  }

  function getInstanceComponentPropertyTarget(
    instanceId: string,
    propertyId: string
  ): {
    instance: SceneNode
    definition: ComponentPropertyDefinition
  } | null {
    const instance = ctx.graph.getNode(instanceId)
    if (instance?.type !== 'INSTANCE') return null
    const own = definitionsForInstance(ctx, instance).find((item) => item.id === propertyId)
    if (own) return { instance, definition: own }
    const nested = nestedComponentProperties(
      ctx.graph,
      instance,
      getInstanceComponentPropertyDefinitions
    ).find((item) => item.id === propertyId)
    return nested
      ? getInstanceComponentPropertyTarget(nested.instance.id, nested.definition.id)
      : null
  }

  function getInstanceComponentPropertyValue(
    instanceId: string,
    definition: ComponentPropertyDefinition
  ): string {
    const instance = ctx.graph.getNode(instanceId)
    if (instance?.type !== 'INSTANCE') return definition.defaultValue
    const target = getInstanceComponentPropertyTarget(instanceId, definition.id)
    if (target && target.instance.id !== instanceId)
      return getInstanceComponentPropertyValue(target.instance.id, target.definition)
    if (definition.type === 'VARIANT') {
      const component = instanceMainComponent(ctx.graph, instance)
      return component?.componentPropertyValues[definition.name] ?? definition.defaultValue
    }
    const value =
      instancePropertyAssignment(ctx.graph, instance, definition.id) ?? definition.defaultValue
    return definition.type === 'INSTANCE_SWAP' ? (swapTargetId(ctx, value) ?? value) : value
  }

  function setInstanceComponentProperty(
    instanceId: string,
    propertyId: string,
    value: string,
    inherited = false
  ) {
    const instance = ctx.graph.getNode(instanceId)
    if (instance?.type !== 'INSTANCE') return
    assertNodeEditable(ctx.graph, instanceId)
    const definition = definitionsForInstance(ctx, instance).find((item) => item.id === propertyId)
    if (!definition) {
      const nested = nestedComponentProperties(
        ctx.graph,
        instance,
        getInstanceComponentPropertyDefinitions
      ).find((item) => item.id === propertyId)
      if (!nested) return
      ctx.undo.runBatch(`Change ${nested.name}`, () => {
        const before = cloneInstanceOverrideState(instance.instanceOverrides)
        setInstanceComponentProperty(nested.instance.id, nested.definition.id, value, inherited)
        const after = cloneInstanceOverrideState(instance.instanceOverrides)
        setInstanceOverride(
          after,
          instanceId,
          nested.instance.id,
          'sourceComponentId',
          nested.sourceId
        )
        if (nested.definition.type === 'VARIANT') {
          setInstanceOverride(
            after,
            instanceId,
            nested.instance.id,
            'componentId',
            nested.instance.componentId
          )
        }
        const apply = (overrides: typeof before) =>
          ctx.graph.updateNode(instanceId, {
            instanceOverrides: cloneInstanceOverrideState(overrides)
          })
        ctx.undo.execute({
          label: `Change ${nested.name}`,
          forward: () => apply(after),
          inverse: () => apply(before)
        })
      })
      return
    }
    if (definition.type === 'VARIANT') {
      switchVariant(instanceId, definition.name, value)
      return
    }

    const previousAssignments = { ...instance.componentPropertyAssignments }
    const previousOverrides = cloneInstanceOverrideState(instance.instanceOverrides)

    const targets = findComponentPropertyTargets(ctx.graph, instance, propertyId).map((target) => ({
      nodeId: target.node.id,
      sourceId: target.source.id,
      field: target.field,
      value:
        definition.type === 'INSTANCE_SWAP' && previousAssignments[propertyId]
          ? (swapTargetId(ctx, previousAssignments[propertyId]) ?? previousAssignments[propertyId])
          : targetValue(target)
    }))

    const apply = () => {
      if (!applyInstancePropertyValue(ctx.graph, instanceId, definition, value, inherited))
        return false
      refreshPropertyLayout(instanceId, definition)
      ctx.requestRender()
      return true
    }
    if (!apply()) return
    ctx.undo.push({
      label: `Change ${definition.name}`,
      forward: apply,
      inverse: () => {
        const live = ctx.graph.getNode(instanceId)
        if (live) {
          ctx.graph.updateNode(instanceId, {
            componentPropertyAssignments: previousAssignments,
            instanceOverrides: cloneInstanceOverrideState(previousOverrides)
          })
          for (const target of targets) {
            const restoredNode = ctx.graph.getNode(target.nodeId)
            if (target.field === 'TEXT' && restoredNode?.type === 'TEXT') {
              ctx.graph.updateNode(restoredNode.id, { text: target.value })
            } else if (target.field === 'VISIBLE' && restoredNode) {
              ctx.graph.updateNode(restoredNode.id, { visible: target.value === 'true' })
            } else if (target.field === 'INSTANCE_SWAP' && restoredNode?.type === 'INSTANCE') {
              const componentId = swapTargetId(ctx, target.value)
              if (componentId) {
                ctx.graph.swapInstanceComponent(restoredNode.id, componentId)
                setInstanceOverride(
                  live.instanceOverrides,
                  live.id,
                  restoredNode.id,
                  'sourceComponentId',
                  target.sourceId
                )
                ctx.graph.updateNode(live.id, { instanceOverrides: live.instanceOverrides })
              }
            }
          }
        }
        refreshPropertyLayout(instanceId, definition)
        ctx.requestRender()
      }
    })
    ctx.requestRender()
  }

  return {
    getInstanceComponentPropertyDefinitions,
    getInstanceComponentPropertyTarget,
    getInstanceComponentPropertyValue,
    reapplyInstanceComponentProperties: (instanceId: string) =>
      reapplyInstanceComponentProperties(ctx, instanceId),
    setInstanceComponentProperty
  }
}
