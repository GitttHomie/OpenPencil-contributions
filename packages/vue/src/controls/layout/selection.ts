import { computed } from 'vue'

import type { LayoutMode, LayoutSizing, SceneNode } from '@open-pencil/scene-graph'

import { MIXED, useNodeProps } from '#vue/controls/node-props/use'

import { heightSizingForNode, sizingOptionsForNode, widthSizingForNode } from './helpers'
import type { SizeLimitProp } from './helpers'

/** Layout capabilities and sizing shared by every selected node. */
export function useSelectionLayout() {
  const selection = useNodeProps()
  const { nodes, store } = selection
  const containers = new Set(['FRAME', 'COMPONENT', 'COMPONENT_SET', 'INSTANCE'])
  const every = (predicate: (node: SceneNode) => boolean) =>
    nodes.value.length > 0 && nodes.value.every(predicate)
  const allContainers = computed(() => every((node) => containers.has(node.type)))
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
  function parentMode(node: SceneNode): LayoutMode {
    void store.state.sceneVersion
    return node.parentId ? (store.getNode(node.parentId)?.layoutMode ?? 'NONE') : 'NONE'
  }
  function inFlow(node: SceneNode) {
    return node.layoutPositioning !== 'ABSOLUTE' && parentMode(node) !== 'NONE'
  }
  function sizing(axis: 'width' | 'height') {
    const read = axis === 'width' ? widthSizingForNode : heightSizingForNode
    const values = nodes.value.map((node) => read(node, inFlow(node), parentMode(node)))
    return values.length && values.every((value) => value === values[0]) ? values[0] : MIXED
  }
  const sizingOptions = computed(() => {
    const first = nodes.value.at(0)
    if (!first) return []
    return sizingOptionsForNode(first, inFlow(first)).filter(({ value }) =>
      nodes.value.every((node) =>
        sizingOptionsForNode(node, inFlow(node)).some((option) => option.value === value)
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
