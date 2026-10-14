import { computed } from 'vue'

import type { LayoutMode, LayoutSizing, NodeType, SceneNode } from '@open-pencil/scene-graph'

import { MIXED, useNodeProps, type MixedValue } from '#vue/controls/node-props/use'
import { useUndoBatch } from '#vue/controls/undo-batch/use'
import { useSceneComputed } from '#vue/internal/scene-computed/use'

import { axisSizingForNode, sizingOptionsForNode } from './helpers'
import type { SizeLimitProp } from './helpers'

/** Layers that can hold an auto layout and clip their content. */
export const LAYOUT_CONTAINER_TYPES: ReadonlySet<NodeType> = new Set<NodeType>([
  'FRAME',
  'COMPONENT',
  'COMPONENT_SET',
  'INSTANCE'
])

export type TextResizeMode = 'AUTO_WIDTH' | 'AUTO_HEIGHT' | 'FIXED'

export function textResizeMode(node: SceneNode): TextResizeMode {
  if (node.textAutoResize === 'WIDTH_AND_HEIGHT') return 'AUTO_WIDTH'
  if (node.textAutoResize === 'HEIGHT' || node.textAutoResize === 'TRUNCATE') return 'AUTO_HEIGHT'
  return 'FIXED'
}

/** Layout capabilities and sizing shared by every selected node. */
export function useSelectionLayout() {
  const selection = useNodeProps()
  const { nodes, store } = selection
  const batch = useUndoBatch(store.undo, store.beginInteractiveEdit)
  const every = (predicate: (node: SceneNode) => boolean) =>
    nodes.value.length > 0 && nodes.value.every(predicate)
  const allContainers = computed(() => every((node) => LAYOUT_CONTAINER_TYPES.has(node.type)))
  const allText = computed(() => every((node) => node.type === 'TEXT'))
  const allAutoLayout = computed(
    () => allContainers.value && every((node) => node.layoutMode !== 'NONE')
  )
  const allFlex = computed(
    () =>
      allContainers.value &&
      every((node) => node.layoutMode === 'HORIZONTAL' || node.layoutMode === 'VERTICAL')
  )
  const allGrid = computed(() => allContainers.value && every((node) => node.layoutMode === 'GRID'))
  const rowSpacing = useSceneComputed(() =>
    store.selectionSpacing(nodes.value.map((node) => node.id))
  )
  const spacingAxis = computed(() => rowSpacing.value?.axis)
  const spacing = computed<MixedValue<number>>(() => {
    const gaps = rowSpacing.value?.gaps.map((gap) => Math.round(gap * 100) / 100) ?? []
    const first = gaps.at(0)
    return first !== undefined && gaps.every((gap) => gap === first) ? first : MIXED
  })
  function setSpacing(gap: number) {
    batch.ensure('selection-spacing', 'Change spacing')
    store.setSelectionSpacing(
      nodes.value.map((node) => node.id),
      gap
    )
  }
  function sizing(axis: 'width' | 'height') {
    void store.state.sceneVersion
    const values = nodes.value.map((node) => axisSizingForNode(store.graph, node, axis))
    return values.length && values.every((value) => value === values[0]) ? values[0] : MIXED
  }
  const sizingOptions = computed(() => {
    void store.state.sceneVersion
    const first = nodes.value.at(0)
    if (!first) return []
    return sizingOptionsForNode(store.graph, first).filter(({ value }) =>
      nodes.value.every((node) =>
        sizingOptionsForNode(store.graph, node).some((option) => option.value === value)
      )
    )
  })
  function setMode(mode: LayoutMode) {
    if (!allContainers.value) return
    const ids = nodes.value.map((node) => node.id)
    store.undo.runBatch('Change selection layout', () => {
      for (const id of ids) store.setLayoutMode(id, mode)
    })
  }
  function setSizing(axis: 'width' | 'height', value: LayoutSizing) {
    if (!sizingOptions.value.some((option) => option.value === value)) return
    const ids = nodes.value.map((node) => node.id)
    store.undo.runBatch(`Set selection ${axis} sizing`, () => {
      for (const id of ids) store.setLayoutSizing(id, axis, value)
    })
  }
  function updateEach(label: string, patch: (node: SceneNode) => Partial<SceneNode>) {
    const changes = nodes.value.map((node) => ({ id: node.id, updates: patch(node) }))
    store.undo.runBatch(label, () => {
      for (const { id, updates } of changes) store.updateNodeWithUndo(id, updates, label)
    })
  }
  function setSizeLimit(prop: SizeLimitProp, action: 'add' | 'current' | 'remove') {
    updateEach(`Change ${prop}`, (node) => {
      if (action === 'remove') return { [prop]: null }
      if (action === 'add' && node[prop] != null) return {}
      return { [prop]: Math.round(prop.endsWith('Width') ? node.width : node.height) }
    })
  }
  function setWrap(enabled: boolean) {
    updateEach('Change layout wrap', (node) => ({
      layoutWrap: enabled ? 'WRAP' : 'NO_WRAP',
      primaryAxisAlign:
        enabled && node.primaryAxisAlign === 'SPACE_BETWEEN' ? 'MIN' : node.primaryAxisAlign
    }))
  }
  function setPhysicalAlignment(
    horizontal: 'MIN' | 'CENTER' | 'MAX',
    vertical: 'MIN' | 'CENTER' | 'MAX'
  ) {
    updateEach('Align selection contents', (node) => {
      const primary = node.layoutMode === 'HORIZONTAL' ? horizontal : vertical
      return {
        primaryAxisAlign: node.primaryAxisAlign === 'SPACE_BETWEEN' ? 'SPACE_BETWEEN' : primary,
        counterAxisAlign: node.layoutMode === 'HORIZONTAL' ? vertical : horizontal
      }
    })
  }
  return {
    ...selection,
    allContainers,
    allText,
    allAutoLayout,
    allFlex,
    allGrid,
    spacingAxis,
    spacing,
    setSpacing,
    flushSpacing: batch.flush,
    sizingOptions,
    sizing,
    setMode,
    setSizing,
    updateEach,
    setSizeLimit,
    setWrap,
    setPhysicalAlignment
  }
}
