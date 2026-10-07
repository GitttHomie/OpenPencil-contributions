import { isEqual } from 'es-toolkit'

import {
  removeComponentProperty,
  resolveComponentPropertyValue,
  OPEN_PENCIL_PLUGIN_DATA,
  readPluginData
} from '@open-pencil/scene-graph'
import type { ComponentPropertyDefinition, SceneNode } from '@open-pencil/scene-graph'

import { assertNodeEditable } from '#core/editor/capabilities'
import type { EditorContext } from '#core/editor/types'
import { randomHex } from '#core/random'

import {
  COMPONENT_FIELD_TYPES,
  componentAuthoringContext,
  componentBindingNodes,
  componentPropertySources,
  componentFieldValue,
  componentPropertyNameExists,
  type ExposableComponentField
} from './context'
import { createAuthoringValueActions } from './values'
import { prepareVariantDefault, variantDefaultForSource } from './variant-default'

type PropertyMetadata = Pick<
  SceneNode,
  | 'componentPropertyDefinitions'
  | 'componentPropertyReferences'
  | 'componentPropertyAssignments'
  | 'pluginData'
>

function metadata(node: SceneNode): PropertyMetadata {
  return structuredClone({
    componentPropertyDefinitions: node.componentPropertyDefinitions,
    componentPropertyReferences: node.componentPropertyReferences,
    componentPropertyAssignments: node.componentPropertyAssignments,
    pluginData: node.pluginData
  })
}

export function createComponentAuthoringActions(
  ctx: EditorContext,
  setInstanceProperty: (
    instanceId: string,
    propertyId: string,
    value: string,
    inherited?: boolean
  ) => void
) {
  function patch(id: string, changes: Partial<SceneNode>, label: string) {
    const node = ctx.graph.getNode(id)
    if (!node) return
    const before = Object.fromEntries(
      Object.keys(changes).map((key) => [key, structuredClone(node[key as keyof SceneNode])])
    )
    const apply = (values: Partial<SceneNode>) => {
      ctx.graph.updateNode(id, structuredClone(values))
      if ('text' in values || 'visible' in values) ctx.runLayoutForNode(id)
      ctx.requestRender()
    }
    ctx.undo.execute({
      label,
      forward: () => apply(changes),
      inverse: () => apply(before)
    })
  }

  const sourceValues = createAuthoringValueActions(ctx, patch)

  function bindingContext(nodeId: string, field: ExposableComponentField) {
    const context = componentAuthoringContext(ctx.graph, nodeId)
    if (!context?.fields.includes(field)) return null
    assertNodeEditable(ctx.graph, nodeId)
    assertNodeEditable(ctx.graph, context.owner.id)
    return context
  }

  function bindComponentProperty(
    nodeId: string,
    field: ExposableComponentField,
    propertyId: string | null
  ): boolean {
    const context = bindingContext(nodeId, field)
    if (!context) return false
    const { node, component, owners } = context
    const definition = owners
      .flatMap((owner) => owner.componentPropertyDefinitions)
      .find((item) => item.id === propertyId)
    if (propertyId && definition?.type !== COMPONENT_FIELD_TYPES[field]) return false
    const variantDefaults =
      readPluginData(component.pluginData, OPEN_PENCIL_PLUGIN_DATA.componentVariantDefaults) ?? {}
    const defaultValue = definition
      ? (variantDefaults[definition.id] ?? definition.defaultValue)
      : ''
    if (definition && !sourceValues.accepts(node, field, defaultValue)) return false
    const references = node.componentPropertyReferences.filter((item) => item.field !== field)
    if (propertyId) references.push({ propertyId, field })
    if (isEqual(references, node.componentPropertyReferences)) return true

    ctx.undo.runBatch(
      propertyId ? 'Expose component property' : 'Unbind component property',
      () => {
        patch(nodeId, { componentPropertyReferences: references }, 'Bind component property')
        if (definition) {
          sourceValues.apply(node, field, defaultValue)
          ctx.graph.syncInstances(component.id)
          for (const instance of ctx.graph.getInstances(component.id)) {
            const assigned = Object.hasOwn(instance.componentPropertyAssignments, definition.id)
            const value = assigned
              ? instance.componentPropertyAssignments[definition.id]
              : defaultValue
            setInstanceProperty(instance.id, definition.id, value, !assigned)
          }
        }
      }
    )
    return true
  }

  function createComponentProperty(
    ownerId: string,
    name: string,
    type: ComponentPropertyDefinition['type'],
    defaultValue: string
  ): string | null {
    const owner = ctx.graph.getNode(ownerId)
    if (owner?.type !== 'COMPONENT' && owner?.type !== 'COMPONENT_SET') return null
    assertNodeEditable(ctx.graph, ownerId)
    const normalizedName = name.trim()
    if (!normalizedName || componentPropertyNameExists(ctx.graph, owner, normalizedName))
      return null
    if (!['TEXT', 'BOOLEAN', 'INSTANCE_SWAP'].includes(type)) return null
    if (type === 'BOOLEAN' && defaultValue !== 'true' && defaultValue !== 'false') return null
    if (type === 'INSTANCE_SWAP' && !resolveComponentPropertyValue(ctx.graph, defaultValue))
      return null
    const id = `prop:${randomHex(8)}`
    const definition: ComponentPropertyDefinition = { id, name: normalizedName, type, defaultValue }
    patch(
      ownerId,
      { componentPropertyDefinitions: [...owner.componentPropertyDefinitions, definition] },
      'Create component property'
    )
    return id
  }

  function exposeComponentProperty(
    nodeId: string,
    field: ExposableComponentField,
    name: string
  ): string | null {
    const context = bindingContext(nodeId, field)
    if (!context) return null
    let id: string | null = null
    ctx.undo.runBatch('Expose component property', () => {
      id = createComponentProperty(
        context.owner.id,
        name,
        COMPONENT_FIELD_TYPES[field],
        componentFieldValue(context.node, field)
      )
      if (id) bindComponentProperty(nodeId, field, id)
    })
    return id
  }

  function renameComponentProperty(ownerId: string, propertyId: string, name: string): boolean {
    const editable = editableProperty(ownerId, propertyId)
    const normalizedName = name.trim()
    if (
      !editable ||
      !normalizedName ||
      componentPropertyNameExists(ctx.graph, editable.owner, normalizedName, propertyId)
    )
      return false
    const { owner, definition } = editable
    if (definition.name !== normalizedName) {
      patch(
        ownerId,
        {
          componentPropertyDefinitions: owner.componentPropertyDefinitions.map((item) =>
            item.id === propertyId ? { ...item, name: normalizedName } : item
          )
        },
        'Rename component property'
      )
    }
    return true
  }

  function editableProperty(ownerId: string, propertyId: string) {
    const owner = ctx.graph.getNode(ownerId)
    if (owner?.type !== 'COMPONENT' && owner?.type !== 'COMPONENT_SET') return null
    assertNodeEditable(ctx.graph, ownerId)
    const definition = owner.componentPropertyDefinitions.find((item) => item.id === propertyId)
    return definition && definition.type !== 'VARIANT' ? { owner, definition } : null
  }

  function enableComponentProperty(
    nodeId: string,
    field: ExposableComponentField,
    suggestedName: string
  ): string | null {
    const context = bindingContext(nodeId, field)
    if (!context) return null
    const existing = context.node.componentPropertyReferences.find((item) => item.field === field)
    if (existing) return existing.propertyId
    const base = suggestedName.trim() || context.node.name.trim() || field
    let name = base
    let suffix = 2
    while (componentPropertyNameExists(ctx.graph, context.owner, name)) {
      name = `${base} ${suffix++}`
    }
    return exposeComponentProperty(nodeId, field, name)
  }

  function setComponentPropertyDefault(
    ownerId: string,
    propertyId: string,
    value: string
  ): boolean {
    const editable = editableProperty(ownerId, propertyId)
    if (!editable || !['TEXT', 'BOOLEAN', 'INSTANCE_SWAP'].includes(editable.definition.type))
      return false
    const { owner, definition } = editable
    if (definition.type === 'BOOLEAN' && value !== 'true' && value !== 'false') return false
    if (definition.type === 'INSTANCE_SWAP' && !resolveComponentPropertyValue(ctx.graph, value))
      return false
    const targets = componentPropertySources(ctx.graph, ownerId, propertyId)
    if (targets.some(({ node, field }) => !sourceValues.accepts(node, field, value))) return false
    for (const { node } of targets) assertNodeEditable(ctx.graph, node.id)
    ctx.undo.runBatch('Change component property default', () => {
      patch(
        ownerId,
        {
          componentPropertyDefinitions: owner.componentPropertyDefinitions.map((item) =>
            item.id === propertyId ? { ...item, defaultValue: value } : item
          )
        },
        'Change property default'
      )
      for (const { node, field } of targets) {
        if (variantDefaultForSource(ctx.graph, node.id, propertyId) === undefined)
          sourceValues.apply(node, field, value)
      }
    })
    return true
  }

  function setComponentPropertyVariantDefault(
    variantId: string,
    propertyId: string,
    value: string | null
  ): boolean {
    const edit = prepareVariantDefault(ctx.graph, variantId, propertyId, value)
    if (!edit) return false
    ctx.undo.runBatch('Change variant property default', () => {
      patch(variantId, { pluginData: edit.pluginData }, 'Change variant default')
      for (const { node, field } of edit.targets) sourceValues.apply(node, field, edit.value)
    })
    return true
  }

  function deleteComponentProperty(ownerId: string, propertyId: string): boolean {
    if (!editableProperty(ownerId, propertyId)) return false
    const affected = [...ctx.graph.getAllNodes()].filter(
      (node) =>
        node.id === ownerId ||
        node.componentPropertyReferences.some((reference) => reference.propertyId === propertyId) ||
        Object.hasOwn(node.componentPropertyAssignments, propertyId) ||
        Object.hasOwn(
          readPluginData(node.pluginData, OPEN_PENCIL_PLUGIN_DATA.componentVariantDefaults) ?? {},
          propertyId
        )
    )
    const before = new Map(affected.map((node) => [node.id, metadata(node)]))
    removeComponentProperty(ctx.graph, ownerId, propertyId)
    const after = new Map(affected.map((node) => [node.id, metadata(node)]))
    const apply = (values: Map<string, PropertyMetadata>) => {
      for (const [id, value] of values) ctx.graph.updateNode(id, structuredClone(value))
      ctx.requestRender()
    }
    ctx.undo.push({
      label: 'Delete component property',
      forward: () => apply(after),
      inverse: () => apply(before)
    })
    ctx.requestRender()
    return true
  }

  return {
    getComponentPropertyAuthoring: (nodeId: string) => componentAuthoringContext(ctx.graph, nodeId),
    getComponentPropertyBindings: (ownerId: string, propertyId: string) =>
      componentBindingNodes(ctx.graph, ownerId).flatMap((node) =>
        node.componentPropertyReferences
          .filter((reference) => reference.propertyId === propertyId)
          .map((reference) => ({ nodeId: node.id, name: node.name, field: reference.field }))
      ),
    createComponentProperty,
    exposeComponentProperty,
    enableComponentProperty,
    bindComponentProperty,
    renameComponentProperty,
    setComponentPropertyDefault,
    setComponentPropertyVariantDefault,
    deleteComponentProperty
  }
}
