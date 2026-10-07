import { computed, ref, watch } from 'vue'

import type { VariantConflict } from '@open-pencil/core/editor'
import type { ComponentPropertyDefinition, SceneNode } from '@open-pencil/scene-graph'

import { useEditor } from '#vue/editor/context'
import { useSceneComputed } from '#vue/internal/scene-computed/use'

export interface VariantDefinitionControl {
  id: string
  name: string
  values: string[]
}

export interface VariantPropertyControl extends VariantDefinitionControl {
  usage: Record<string, number>
}

function variantContext(node: SceneNode | null, graph: ReturnType<typeof useEditor>['graph']) {
  if (node?.type === 'COMPONENT_SET') return { componentSet: node, variant: null }
  if (node?.type !== 'COMPONENT' || !node.parentId) return null
  const parent = graph.getNode(node.parentId)
  return parent?.type === 'COMPONENT_SET' ? { componentSet: parent, variant: node } : null
}

export function useVariantAuthoring() {
  const editor = useEditor()
  const context = useSceneComputed(() => {
    void editor.state.sceneVersion
    const selected = editor.getSelectedNodes()
    return selected.length === 1 ? variantContext(selected[0] ?? null, editor.graph) : null
  })
  const active = computed(() => context.value !== null)
  const standalone = useSceneComputed(() => {
    const selected = editor.getSelectedNodes()
    const node = selected.length === 1 ? selected[0] : null
    return node?.type === 'COMPONENT' && !context.value ? node : null
  })
  const componentSet = computed(() => context.value?.componentSet ?? null)
  const variant = computed(() => context.value?.variant ?? null)
  const variants = useSceneComputed(() =>
    componentSet.value
      ? editor.graph.getChildren(componentSet.value.id).filter((node) => node.type === 'COMPONENT')
      : []
  )
  const definitions = useSceneComputed<VariantPropertyControl[]>(() => {
    void editor.state.sceneVersion
    const componentSetId = componentSet.value?.id
    if (!componentSetId) return []
    return editor
      .getComponentSetPropertyDefs(componentSetId)
      .filter(
        (definition): definition is ComponentPropertyDefinition => definition.type === 'VARIANT'
      )
      .map((definition) => ({
        id: definition.id,
        name: definition.name,
        values: editor.getVariantOptions(componentSetId, definition.id),
        usage: Object.fromEntries(
          editor
            .getVariantOptions(componentSetId, definition.id)
            .map((value) => [
              value,
              variants.value.filter(
                (node) => node.componentPropertyValues[definition.name] === value
              ).length
            ])
        )
      }))
  })
  const diagnostics = useSceneComputed<VariantConflict[]>(() => {
    void editor.state.sceneVersion
    const componentSetId = componentSet.value?.id
    return componentSetId ? editor.getComponentSetVariantConflicts(componentSetId) : []
  })

  const rejectedIds = ref<string[]>([])
  watch(
    () => componentSet.value?.id,
    () => {
      rejectedIds.value = []
    }
  )
  watch(definitions, () => {
    rejectedIds.value = []
  })
  const conflicts = useSceneComputed(() => {
    const groups = diagnostics.value.filter(
      (group) => !variant.value || group.componentIds.includes(variant.value.id)
    )
    const ids = new Set([...groups.flatMap((group) => group.componentIds), ...rejectedIds.value])
    return [...ids].flatMap((id) => {
      const node = editor.graph.getNode(id)
      return node ? [{ id, name: node.name }] : []
    })
  })
  function addValue(propertyId: string, value: string) {
    return componentSet.value
      ? editor.addVariantValue(componentSet.value.id, propertyId, value)
      : false
  }
  function removeValue(propertyId: string, value: string, replacement?: string) {
    const result = componentSet.value
      ? editor.removeVariantValue(componentSet.value.id, propertyId, value, replacement)
      : { kind: 'invalid' as const }
    rejectedIds.value = result.kind === 'conflict' ? result.componentIds : []
    return result.kind === 'changed'
  }

  /**
   * Add a variant property, by default named Property 1, Property 2, … with the value Default,
   * as Figma does; returns its id so the caller can start renaming it.
   */
  function addProperty(name?: string, initialValue = 'Default'): string | undefined {
    const componentSetId = componentSet.value?.id
    if (!componentSetId) return undefined
    return editor.addPropertyDefinition(
      componentSetId,
      name ?? nextPropertyName(),
      'VARIANT',
      initialValue
    )
  }

  function nextPropertyName(): string {
    const taken = new Set(definitions.value.map((definition) => definition.name))
    let index = 1
    while (taken.has(`Property ${index}`)) index++
    return `Property ${index}`
  }

  function renameProperty(propertyId: string, name: string) {
    const componentSetId = componentSet.value?.id
    return componentSetId
      ? editor.renamePropertyDefinition(componentSetId, propertyId, name)
      : false
  }

  function removeProperty(propertyId: string) {
    const componentSetId = componentSet.value?.id
    return componentSetId ? editor.removePropertyDefinition(componentSetId, propertyId) : false
  }

  function reorderProperties(propertyIds: string[]) {
    const componentSetId = componentSet.value?.id
    return componentSetId ? editor.reorderPropertyDefinitions(componentSetId, propertyIds) : false
  }

  function renameValue(propertyId: string, previousValue: string, value: string) {
    const componentSetId = componentSet.value?.id
    return componentSetId
      ? editor.renameVariantValue(componentSetId, propertyId, previousValue, value)
      : false
  }

  function reorderValues(propertyId: string, values: string[]) {
    const componentSetId = componentSet.value?.id
    return componentSetId ? editor.reorderVariantValues(componentSetId, propertyId, values) : false
  }

  function setVariantValue(propertyId: string, value: string, variantId = variant.value?.id) {
    const result = variantId
      ? editor.setVariantPropertyValue(variantId, propertyId, value)
      : { kind: 'invalid' as const }
    rejectedIds.value = result.kind === 'conflict' ? result.componentIds : []
    return result
  }

  function addVariant() {
    const componentSetId = componentSet.value?.id
    const target = variant.value?.id ?? componentSetId ?? standalone.value?.id
    return target ? editor.addVariant(target) : undefined
  }

  function duplicateVariant() {
    const source =
      variant.value ?? editor.getDefaultVariantForComponentSet(componentSet.value?.id ?? '')
    return source ? editor.duplicateVariant(source.id) : undefined
  }

  function removeVariant(id = variant.value?.id) {
    return id ? editor.removeVariant(id) : false
  }

  function moveVariant(id: string, index: number) {
    const set = componentSet.value
    if (!set || index < 0 || index >= variants.value.length) return
    const ids = variants.value.map((node) => node.id).filter((item) => item !== id)
    ids.splice(index, 0, id)
    editor.reorderVariants(set.id, ids)
  }

  return {
    active,
    standalone,
    componentSet,
    variant,
    variants,
    definitions,
    diagnostics,
    conflicts,
    addValue,
    removeValue,
    selectVariant: (id: string) => editor.select([id]),
    addProperty,
    renameProperty,
    removeProperty,
    reorderProperties,
    renameValue,
    reorderValues,
    setVariantValue,
    addVariant,
    duplicateVariant,
    removeVariant,
    moveVariant
  }
}
