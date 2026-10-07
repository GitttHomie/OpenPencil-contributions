import { computed } from 'vue'

import {
  canCreateInstance,
  nestedPropertyId,
  orderComponentProperties,
  OPEN_PENCIL_PLUGIN_DATA,
  readPluginData
} from '@open-pencil/scene-graph'

import { useEditor } from '#vue/editor/context'
import { useSceneComputed } from '#vue/internal/scene-computed/use'

import { groupComponentBindings } from './bindings'

export function useComponentPropertyAuthoring() {
  const editor = useEditor()
  const context = useSceneComputed(() => {
    const selected = editor.getSelectedNodes()
    return selected.length === 1 ? editor.getComponentPropertyAuthoring(selected[0].id) : null
  })
  const variants = useSceneComputed(() => {
    const owner = context.value?.owner
    return owner?.type === 'COMPONENT_SET'
      ? editor.graph.getChildren(owner.id).filter((node) => node.type === 'COMPONENT')
      : []
  })
  const definitions = useSceneComputed(() =>
    (context.value?.node.type === 'COMPONENT_SET'
      ? [context.value.owner, ...variants.value]
      : (context.value?.owners ?? [])
    ).flatMap((owner) =>
      owner.componentPropertyDefinitions
        .filter((definition) => definition.type !== 'VARIANT' && definition.type !== 'SLOT')
        .map((definition) => {
          const bindings = editor
            .getComponentPropertyBindings(owner.id, definition.id)
            .flatMap((binding) => {
              const node = editor.graph.getNode(binding.nodeId)
              return node ? [{ ...binding, node }] : []
            })
          const bindingGroups = groupComponentBindings(editor.graph, bindings)
          const usedVariants = new Set(
            bindingGroups.flatMap((group) =>
              group.bindings.flatMap((binding) => (binding.variantId ? [binding.variantId] : []))
            )
          )
          return {
            ...definition,
            ownerId: owner.id,
            bindings,
            bindingGroups,
            variants: variants.value
              .filter((variant) => usedVariants.has(variant.id))
              .map((variant) => {
                const defaults =
                  readPluginData(
                    variant.pluginData,
                    OPEN_PENCIL_PLUGIN_DATA.componentVariantDefaults
                  ) ?? {}
                return {
                  id: variant.id,
                  name: variant.name,
                  overridden: Object.hasOwn(defaults, definition.id),
                  value: defaults[definition.id] ?? definition.defaultValue
                }
              }),
            shared: owner.type === 'COMPONENT_SET'
          }
        })
    )
  )
  const components = useSceneComputed(() =>
    [...editor.graph.getAllNodes()].filter((node) => node.type === 'COMPONENT')
  )
  function optionsFor(propertyId: string) {
    const definition = definitions.value.find((item) => item.id === propertyId)
    return components.value.map((node) => ({
      value: node.id,
      label: node.name,
      disabled:
        definition?.bindings.some(
          (binding) =>
            binding.node.parentId &&
            !canCreateInstance(editor.graph, node.id, binding.node.parentId)
        ) ?? false
    }))
  }
  function changeAttributeValue(field: 'TEXT' | 'VISIBLE' | 'INSTANCE_SWAP', value: string) {
    const selected = context.value
    if (!selected?.editable || !selected.fields.includes(field)) return
    if (selected.node.componentPropertyReferences.some((item) => item.field === field)) return
    if (field === 'VISIBLE')
      editor.updateNodeWithUndo(selected.node.id, { visible: value === 'true' })
    else if (field === 'TEXT') editor.updateNodeWithUndo(selected.node.id, { text: value })
  }
  const manage = computed(() => context.value?.fields.length === 0)
  const nestedComponents = useSceneComputed(() =>
    context.value ? editor.getNestedComponentPropertyCandidates(context.value.owner.id) : []
  )
  const entries = useSceneComputed(() => {
    const owner = context.value?.owner
    if (!owner) return []
    return orderComponentProperties(
      [
        ...definitions.value.map((definition) => ({
          kind: 'own' as const,
          id: definition.id,
          name: definition.name,
          definition
        })),
        ...nestedComponents.value.flatMap((candidate) =>
          candidate.properties
            .filter((definition) => candidate.exposed.includes(definition.id))
            .map((definition) => {
              const target = editor.getInstanceComponentPropertyTarget(candidate.id, definition.id)
              let options: ReturnType<typeof optionsFor> = []
              if (definition.type === 'VARIANT' && target) {
                options = editor
                  .getVariantOptionAvailability(target.instance.id, target.definition.name)
                  .map((option) => ({
                    value: option.value,
                    label: option.value,
                    disabled: !option.available
                  }))
              } else if (definition.type === 'INSTANCE_SWAP') {
                options = optionsFor('')
              }
              return {
                kind: 'nested' as const,
                id: nestedPropertyId(candidate.id, definition.id),
                name: `${candidate.name} / ${definition.name}`,
                definition,
                nodeId: candidate.id,
                componentName: candidate.name,
                value: editor.getInstanceComponentPropertyValue(candidate.id, definition),
                options
              }
            })
        )
      ],
      [owner]
    )
  })
  function removeNested(nodeId: string, propertyId: string) {
    const candidate = nestedComponents.value.find((item) => item.id === nodeId)
    if (candidate && context.value)
      editor.setNestedComponentPropertyExposure(
        context.value.owner.id,
        nodeId,
        candidate.exposed.filter((id) => id !== propertyId)
      )
  }
  return {
    context,
    definitions,
    entries,
    removeNested,
    setNestedDefault: editor.setInstanceComponentProperty,
    variants,
    optionsFor,
    changeAttributeValue,
    componentName: (id: string) => components.value.find((node) => node.id === id)?.name ?? id,
    manage,
    nestedComponents,
    setNestedExposure: editor.setNestedComponentPropertyExposure,
    create: editor.createComponentProperty,
    expose: editor.exposeComponentProperty,
    setDefault: editor.setComponentPropertyDefault,
    setVariantDefault: editor.setComponentPropertyVariantDefault,
    selectSet: () => {
      if (context.value) editor.select([context.value.owner.id])
    },
    bind: editor.bindComponentProperty,
    rename: editor.renameComponentProperty,
    remove: editor.deleteComponentProperty,
    canReorder: (sourceId: string, targetId: string) =>
      entries.value.some((item) => item.id === sourceId) &&
      entries.value.some((item) => item.id === targetId),
    reorder: (sourceId: string, index: number) => {
      const owner = context.value?.owner
      const source = entries.value.find((item) => item.id === sourceId)
      if (!owner || !source || index < 0 || index >= entries.value.length) return
      const ordered = [...entries.value]
      ordered.splice(ordered.indexOf(source), 1)
      ordered.splice(index, 0, source)
      editor.reorderExposedComponentProperties(
        owner.id,
        ordered.map((item) => item.id)
      )
    },
    selectBinding: (nodeId: string) => editor.select([nodeId])
  }
}
