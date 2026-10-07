import type { ComponentPropertyDefinition, ComponentPropertyType } from '@open-pencil/scene-graph'
import { cloneInstanceOverrideState, instanceMainComponent } from '@open-pencil/scene-graph'
import { buildVariantName, parseVariantName } from '@open-pencil/scene-graph/variant-name'

import { assertNodeEditable } from '#core/editor/capabilities'
import { restoreSubtree, snapshotSubtree } from '#core/editor/clipboard/subtree-history'
import { reapplyInstanceComponentProperties } from '#core/editor/components/properties'
import type { EditorContext } from '#core/editor/types'
import { invalidateDerivedLayout } from '#core/layout/derived'

import {
  addPropertyDefinition,
  removePropertyDefinition,
  renamePropertyDefinition,
  renameVariantValue,
  reorderVariantValues,
  setVariantPropertyValue
} from './definitions'
import {
  assertComponentSetEditable,
  captureVariantSnapshot,
  refreshVariantOptions,
  restoreVariantSnapshot
} from './history'
import {
  collectVariantOptions,
  findExactVariant,
  findVariantByValues,
  getComponentSet,
  getComponentSetVariantConflicts,
  getComponentSetVariants,
  getDefaultVariantForComponentSet,
  getVariantOptions,
  validateComponentSet,
  variantValues,
  type VariantOptionAvailability,
  type VariantTransitionResult
} from './model'
import { addVariantValue, removeVariantValue } from './options'
import { reorderPropertyDefinitions, reorderVariants } from './order'
import { shareVariantProperties } from './property-scope'
import { releaseInheritedVariantSize, variantInstanceOwners } from './sizing'
import { createVariantSet } from './wrap'

export type {
  VariantConflict,
  VariantMutationResult,
  VariantOptionAvailability,
  VariantTransitionResult,
  VariantValidationIssue
} from './model'

/**
 * Variant authoring on component sets: property definitions and values (in `definitions`), the
 * set's variants, and switching an instance between them. Each edit is one undo step.
 */
export function createVariantActions(ctx: EditorContext) {
  function getComponentSetPropertyDefs(componentSetId: string): ComponentPropertyDefinition[] {
    return getComponentSet(ctx.graph, componentSetId)?.componentPropertyDefinitions ?? []
  }

  function getVariantOptionAvailability(
    instanceId: string,
    propertyName: string
  ): VariantOptionAvailability[] {
    const instance = ctx.graph.getNode(instanceId)
    const component = instance ? instanceMainComponent(ctx.graph, instance) : undefined
    const componentSetId = component?.parentId
    if (instance?.type !== 'INSTANCE' || component?.type !== 'COMPONENT' || !componentSetId) {
      return []
    }
    const definition = getComponentSetPropertyDefs(componentSetId).find(
      (item) => item.type === 'VARIANT' && item.name === propertyName
    )
    const options = definition ? getVariantOptions(ctx.graph, componentSetId, definition.id) : []
    return [...options].map((value) => ({
      value,
      available: Boolean(
        findExactVariant(ctx.graph, componentSetId, {
          ...variantValues(ctx.graph, componentSetId, component),
          [propertyName]: value
        })
      )
    }))
  }

  function switchInstanceVariant(
    instanceId: string,
    propertyName: string,
    newValue: string
  ): VariantTransitionResult {
    assertNodeEditable(ctx.graph, instanceId)
    const instance = ctx.graph.getNode(instanceId)
    if (instance?.type !== 'INSTANCE' || !instance.componentId) return { kind: 'invalid' }
    const component = instanceMainComponent(ctx.graph, instance)
    const componentSetId = component?.parentId
    if (
      component?.type !== 'COMPONENT' ||
      !componentSetId ||
      !getComponentSet(ctx.graph, componentSetId)
    ) {
      return { kind: 'invalid' }
    }

    const requested = {
      ...variantValues(ctx.graph, componentSetId, component),
      [propertyName]: newValue
    }
    const target = findExactVariant(ctx.graph, componentSetId, requested)
    if (!target) return { kind: 'unavailable', requested }
    if (target.id === instance.componentId) return { kind: 'unchanged', componentId: target.id }

    const before = snapshotSubtree(ctx.graph, instanceId)
    const owners = variantInstanceOwners(ctx.graph, instance)
    const captureOwnerOverrides = () =>
      new Map(
        owners.map((owner) => [owner.id, cloneInstanceOverrideState(owner.instanceOverrides)])
      )
    const previousParentOverrides = captureOwnerOverrides()
    const applyComponent = (componentId: string) => {
      releaseInheritedVariantSize(ctx.graph, instance, component, owners)
      ctx.graph.swapInstanceComponent(instanceId, componentId)
      reapplyInstanceComponentProperties(ctx, instanceId)
      invalidateDerivedLayout(ctx.graph, instanceId)
      ctx.runLayoutForNode(instanceId)
      ctx.requestRender()
    }
    applyComponent(target.id)
    const after = snapshotSubtree(ctx.graph, instanceId)
    const afterParentOverrides = captureOwnerOverrides()
    const restore = (snapshot: typeof before, parentOverrides: typeof previousParentOverrides) => {
      const restored = structuredClone(snapshot)
      const root = restored.get(instanceId)
      const live = ctx.graph.getNode(instanceId)
      if (!root || !live) return
      const replacedChildren = Array.from(live.childIds)
      for (const childId of replacedChildren) ctx.graph.deleteNode(childId)
      const { id: _id, type: _type, parentId: _parent, childIds, ...props } = root
      ctx.graph.updateNode(instanceId, props)
      for (const childId of childIds) {
        const child = restored.get(childId)
        if (child) restoreSubtree(ctx.graph, child, instanceId, restored)
      }
      for (const [ownerId, overrides] of parentOverrides)
        ctx.graph.updateNode(ownerId, {
          instanceOverrides: cloneInstanceOverrideState(overrides)
        })
      ctx.runLayoutForNode(instanceId)
      ctx.requestRender()
    }
    ctx.undo.push({
      label: 'Switch variant',
      forward: () => restore(after, afterParentOverrides),
      inverse: () => restore(before, previousParentOverrides)
    })
    return { kind: 'changed', componentId: target.id }
  }

  function cloneVariant(variantId: string): string | undefined {
    assertNodeEditable(ctx.graph, variantId)
    const variant = ctx.graph.getNode(variantId)
    const componentSetId = variant?.parentId
    if (
      variant?.type !== 'COMPONENT' ||
      !componentSetId ||
      !getComponentSet(ctx.graph, componentSetId)
    ) {
      return undefined
    }
    const clone = ctx.graph.cloneTree(variantId, componentSetId, {
      x: variant.x + variant.width + 40,
      name: variant.name
    })
    if (!clone) return undefined
    const snapshots = snapshotSubtree(ctx.graph, clone.id)
    ctx.setSelectedIds(new Set([clone.id]))
    ctx.undo.push({
      label: 'Add variant',
      forward: () => {
        const root = snapshots.get(clone.id)
        if (root) restoreSubtree(ctx.graph, root, componentSetId, snapshots)
        ctx.setSelectedIds(new Set([clone.id]))
        ctx.runLayoutForNode(componentSetId)
        ctx.requestRender()
      },
      inverse: () => {
        ctx.graph.deleteNode(clone.id)
        ctx.setSelectedIds(new Set([variantId]))
        ctx.runLayoutForNode(componentSetId)
        ctx.requestRender()
      }
    })
    ctx.runLayoutForNode(componentSetId)
    ctx.requestRender()
    return clone.id
  }

  function duplicateVariant(variantId: string): string | undefined {
    let result: string | undefined
    ctx.undo.runBatch('Add variant', () => {
      const source = ctx.graph.getNode(variantId)
      if (source?.type !== 'COMPONENT') return
      let setId = source.parentId
      if (!setId || !getComponentSet(ctx.graph, setId))
        setId = createVariantSet(ctx, [source]) ?? null
      if (!setId) return
      const set = getComponentSet(ctx.graph, setId)
      if (!set) return
      shareVariantProperties(ctx, source, set)
      let definition = getComponentSetPropertyDefs(setId).find((item) => item.type === 'VARIANT')
      if (!definition) {
        addPropertyDefinition(ctx, setId, 'Variant', 'VARIANT', 'Default')
        definition = getComponentSetPropertyDefs(setId).find((item) => item.type === 'VARIANT')
      }
      result = cloneVariant(variantId)
      if (!result || !definition) return
      const used = collectVariantOptions(ctx.graph, setId).get(definition.name) ?? new Set<string>()
      let number = 2
      while (used.has(`Variant ${number}`)) number++
      setVariantPropertyValue(ctx, result, definition.id, `Variant ${number}`)
      ctx.runLayoutForNode(setId)
    })
    return result
  }

  function addVariant(nodeId: string): string | undefined {
    const node = ctx.graph.getNode(nodeId)
    const source =
      node?.type === 'COMPONENT' ? node : getDefaultVariantForComponentSet(ctx.graph, nodeId)
    return source ? duplicateVariant(source.id) : undefined
  }

  function removeVariant(variantId: string): boolean {
    assertNodeEditable(ctx.graph, variantId)
    const variant = ctx.graph.getNode(variantId)
    const componentSetId = variant?.parentId
    if (variant?.type !== 'COMPONENT' || !componentSetId) return false
    if (getComponentSetVariants(ctx.graph, componentSetId).length <= 1) return false
    assertComponentSetEditable(ctx, componentSetId)
    const before = captureVariantSnapshot(ctx, componentSetId)
    const index = ctx.graph.getNode(componentSetId)?.childIds.indexOf(variantId) ?? 0
    const snapshots = snapshotSubtree(ctx.graph, variantId)
    ctx.graph.deleteNode(variantId)
    refreshVariantOptions(ctx, componentSetId)
    const after = captureVariantSnapshot(ctx, componentSetId)
    ctx.runLayoutForNode(componentSetId)
    ctx.setSelectedIds(new Set([componentSetId]))
    ctx.undo.push({
      label: 'Remove variant',
      forward: () => {
        ctx.graph.deleteNode(variantId)
        if (after) restoreVariantSnapshot(ctx, componentSetId, after)
        ctx.runLayoutForNode(componentSetId)
        ctx.setSelectedIds(new Set([componentSetId]))
        ctx.requestRender()
      },
      inverse: () => {
        const root = snapshots.get(variantId)
        if (root) restoreSubtree(ctx.graph, root, componentSetId, snapshots)
        ctx.graph.insertChildAt(variantId, componentSetId, index)
        if (before) restoreVariantSnapshot(ctx, componentSetId, before)
        ctx.runLayoutForNode(componentSetId)
        ctx.setSelectedIds(new Set([variantId]))
        ctx.requestRender()
      }
    })
    ctx.requestRender()
    return true
  }

  return {
    getComponentSetPropertyDefs,
    getVariantOptions: (setId: string, propertyId: string) =>
      getVariantOptions(ctx.graph, setId, propertyId),
    addVariantValue: (setId: string, propertyId: string, value: string) =>
      addVariantValue(ctx, setId, propertyId, value),
    removeVariantValue: (setId: string, propertyId: string, value: string, replacement?: string) =>
      removeVariantValue(ctx, setId, propertyId, value, replacement),
    addPropertyDefinition: (
      componentSetId: string,
      name: string,
      type?: ComponentPropertyType,
      defaultValue?: string
    ) => addPropertyDefinition(ctx, componentSetId, name, type, defaultValue),
    removePropertyDefinition: (componentSetId: string, propertyId: string) =>
      removePropertyDefinition(ctx, componentSetId, propertyId),
    renamePropertyDefinition: (componentSetId: string, propertyId: string, newName: string) =>
      renamePropertyDefinition(ctx, componentSetId, propertyId, newName),
    reorderPropertyDefinitions: (componentSetId: string, propertyIds: string[]) =>
      reorderPropertyDefinitions(ctx, componentSetId, propertyIds),
    reorderVariants: (componentSetId: string, variantIds: string[]) =>
      reorderVariants(ctx, componentSetId, variantIds),
    renameVariantValue: (
      componentSetId: string,
      propertyId: string,
      previousValue: string,
      newValue: string
    ) => renameVariantValue(ctx, componentSetId, propertyId, previousValue, newValue),
    reorderVariantValues: (componentSetId: string, propertyId: string, values: string[]) =>
      reorderVariantValues(ctx, componentSetId, propertyId, values),
    setVariantPropertyValue: (variantId: string, propertyId: string, value: string) =>
      setVariantPropertyValue(ctx, variantId, propertyId, value),
    parseVariantName,
    buildVariantName,
    collectVariantOptions: (componentSetId: string) =>
      collectVariantOptions(ctx.graph, componentSetId),
    findVariantByValues: (componentSetId: string, values: Record<string, string>) =>
      findVariantByValues(ctx.graph, componentSetId, values),
    getDefaultVariantForComponentSet: (componentSetId: string) =>
      getDefaultVariantForComponentSet(ctx.graph, componentSetId),
    getComponentSetVariantConflicts: (componentSetId: string) =>
      getComponentSetVariantConflicts(ctx.graph, componentSetId),
    validateComponentSet: (componentSetId: string) =>
      validateComponentSet(ctx.graph, componentSetId),
    getVariantOptionAvailability,
    switchInstanceVariant,
    addVariant,
    duplicateVariant,
    removeVariant
  }
}
