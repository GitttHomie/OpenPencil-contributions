import { computed } from 'vue'
import type { ComputedRef, Ref } from 'vue'

import type { Editor } from '@open-pencil/core/editor'
import type { BlendMode, SceneNode } from '@open-pencil/scene-graph'
import { CORNER_RADIUS_PATHS, numberPropertyValue } from '@open-pencil/scene-graph'

import type { CornerGeometryKey, CornerRadiusKey } from '#vue/controls/appearance/types'
import { visibilityPropertyReference } from '#vue/controls/appearance/visibility'
import { MIXED, type MixedValue } from '#vue/controls/node-props/use'

const CORNER_RADIUS_TYPES = new Set([
  'RECTANGLE',
  'ROUNDED_RECTANGLE',
  'FRAME',
  'COMPONENT',
  'INSTANCE'
])

type AppearanceStateOptions = {
  expandedCornerNodeId?: Ref<string | null>
  collapsedCornerNodeId?: Ref<string | null>
  node: ComputedRef<SceneNode | null>
  nodes: ComputedRef<SceneNode[]>
  isMulti: ComputedRef<boolean>
  merged: <K extends keyof SceneNode>(key: K) => MixedValue<SceneNode[K]>
}

type AppearanceActionOptions = AppearanceStateOptions & {
  editor: Editor
}

function cornersHaveEquivalentBindings(node: SceneNode): boolean {
  const first = node.boundVariables.topLeftRadius
  if (!first) return false
  return [
    node.boundVariables.topRightRadius,
    node.boundVariables.bottomRightRadius,
    node.boundVariables.bottomLeftRadius
  ].every((id) => id === first)
}

function hasUnequalCorners(node: SceneNode) {
  return !(
    node.topLeftRadius === node.topRightRadius &&
    node.topLeftRadius === node.bottomRightRadius &&
    node.topLeftRadius === node.bottomLeftRadius
  )
}

export function createAppearanceState({
  node,
  nodes,
  isMulti,
  merged,
  expandedCornerNodeId,
  collapsedCornerNodeId
}: AppearanceStateOptions) {
  const hasCornerRadius = computed(() => {
    if (isMulti.value) return nodes.value.every((n) => CORNER_RADIUS_TYPES.has(n.type))
    return node.value ? CORNER_RADIUS_TYPES.has(node.value.type) : false
  })

  const independentCorners = computed(() => {
    if (isMulti.value) return merged('independentCorners')
    return node.value?.independentCorners ?? false
  })

  const showIndependentCorners = computed(() => {
    const key = nodes.value.map((node) => node.id).join(',') || node.value?.id
    if (collapsedCornerNodeId?.value === key) return false
    if (expandedCornerNodeId?.value === key) return true
    if (isMulti.value) return false
    const selected = node.value
    return selected
      ? expandedCornerNodeId?.value === selected.id ||
          hasUnequalCorners(selected) ||
          (selected.independentCorners && !cornersHaveEquivalentBindings(selected))
      : false
  })

  const cornerRadiusValue = computed(() => {
    const targets = isMulti.value ? nodes.value : []
    if (!isMulti.value && node.value) targets.push(node.value)
    const values = targets.flatMap((target) =>
      CORNER_RADIUS_PATHS.map((path) => numberPropertyValue(target, path))
    )
    const first = values[0]
    return first !== undefined && values.every((value) => value === first) ? first : MIXED
  })

  const cornerRadiusBindingPaths = computed<Array<CornerRadiusKey | 'cornerRadius'>>(() => [
    ...CORNER_RADIUS_PATHS
  ])

  const cornerSmoothingPercent = computed(() => {
    const value = merged('cornerSmoothing')
    return value === MIXED ? MIXED : Math.round(Math.max(0, Math.min(value, 1)) * 100)
  })

  const opacityPercent = computed(() => {
    const v = merged('opacity')
    return v === MIXED ? MIXED : Math.round(v * 100)
  })

  const blendModeValue = computed(() => {
    const v = merged('blendMode')
    return v === MIXED ? MIXED : v
  })

  const visibilityState = computed<'visible' | 'hidden' | 'mixed'>(() => {
    const v = merged('visible')
    if (v === MIXED) return 'mixed'
    return v ? 'visible' : 'hidden'
  })
  const visibilityLinked = computed(() => {
    if (isMulti.value) return nodes.value.some((target) => !!visibilityPropertyReference(target))
    return node.value ? !!visibilityPropertyReference(node.value) : false
  })

  return {
    hasCornerRadius,
    independentCorners,
    showIndependentCorners,
    cornerRadiusValue,
    cornerRadiusBindingPaths,
    cornerSmoothingPercent,
    opacityPercent,
    blendModeValue,
    visibilityState,
    visibilityLinked
  }
}

export function createAppearanceActions({
  editor,
  node,
  nodes,
  isMulti,
  expandedCornerNodeId,
  collapsedCornerNodeId
}: AppearanceActionOptions) {
  const previousCornerValues = new Map<CornerGeometryKey, Map<string, number>>()

  function setBlendMode(value: BlendMode) {
    const selected = node.value
    const targets = isMulti.value ? nodes.value : []
    if (!isMulti.value && selected) targets.push(selected)
    const changed = targets.filter((target) => target.blendMode !== value)
    if (changed.length === 0) return

    editor.undo.runBatch('Change blend mode', () => {
      for (const target of changed) {
        editor.updateNodeWithUndo(target.id, { blendMode: value }, 'Change blend mode')
      }
    })
  }

  function toggleVisibility() {
    if (isMulti.value) {
      const liveNodes = nodes.value
        .map((n) => editor.getNode(n.id))
        .filter((n): n is SceneNode => n != null)
      if (liveNodes.length === 0) return
      if (liveNodes.some(visibilityPropertyReference)) return
      const allVisible = liveNodes.every((n) => n.visible)
      editor.undo.runBatch('Toggle visibility', () => {
        for (const n of liveNodes) {
          editor.updateNodeWithUndo(n.id, { visible: !allVisible }, 'Toggle visibility')
        }
      })
      return
    }

    const selected = node.value
    if (!selected) return
    const liveNode = editor.getNode(selected.id)
    if (!liveNode || visibilityPropertyReference(liveNode)) return
    editor.updateNodeWithUndo(liveNode.id, { visible: !liveNode.visible }, 'Toggle visibility')
  }

  function toggleIndependentCorners() {
    const key = nodes.value.map((node) => node.id).join(',') || node.value?.id
    if (!key || !expandedCornerNodeId || !collapsedCornerNodeId) return
    const state = createAppearanceState({
      node,
      nodes,
      isMulti,
      merged: () => MIXED,
      expandedCornerNodeId,
      collapsedCornerNodeId
    })
    if (state.showIndependentCorners.value) {
      expandedCornerNodeId.value = null
      collapsedCornerNodeId.value = key
    } else {
      collapsedCornerNodeId.value = null
      expandedCornerNodeId.value = key
    }
  }

  function cornerTargets() {
    if (isMulti.value) return nodes.value
    const selected = node.value
    return selected ? [selected] : []
  }

  function updateCornerProp(key: CornerGeometryKey, value: number) {
    let snapshots = previousCornerValues.get(key)
    if (!snapshots) {
      snapshots = new Map()
      previousCornerValues.set(key, snapshots)
    }
    const normalized = key === 'cornerSmoothing' ? Math.max(0, Math.min(value, 1)) : value
    for (const target of cornerTargets()) {
      if (!snapshots.has(target.id)) snapshots.set(target.id, target[key])
      editor.updateNode(target.id, { [key]: normalized })
    }
  }

  function commitCornerProp(key: CornerGeometryKey, _value: number, previous: number) {
    const targets = cornerTargets()
    const snapshots = previousCornerValues.get(key)
    const commit = () => {
      for (const target of targets) {
        editor.commitNodeUpdate(
          target.id,
          { [key]: snapshots?.get(target.id) ?? previous } as Partial<SceneNode>,
          `Change ${key}`
        )
      }
    }
    if (targets.length > 1) editor.undo.runBatch(`Change ${key}`, commit)
    else commit()
    previousCornerValues.delete(key)
  }

  type UniformCorners = Pick<SceneNode, CornerRadiusKey | 'cornerRadius' | 'independentCorners'>
  const previousUniformCorners = new Map<string, UniformCorners>()

  function updateUniformRadius(value: number) {
    for (const target of cornerTargets()) {
      if (!previousUniformCorners.has(target.id)) {
        previousUniformCorners.set(target.id, {
          cornerRadius: target.cornerRadius,
          independentCorners: target.independentCorners,
          topLeftRadius: target.topLeftRadius,
          topRightRadius: target.topRightRadius,
          bottomRightRadius: target.bottomRightRadius,
          bottomLeftRadius: target.bottomLeftRadius
        })
      }
      editor.updateNode(target.id, {
        cornerRadius: value,
        independentCorners: false,
        topLeftRadius: value,
        topRightRadius: value,
        bottomRightRadius: value,
        bottomLeftRadius: value
      })
    }
  }

  function commitUniformRadius() {
    editor.undo.runBatch('Change corner radius', () => {
      for (const [id, previous] of previousUniformCorners) {
        editor.commitNodeUpdate(id, previous, 'Change corner radius')
      }
    })
    previousUniformCorners.clear()
  }

  return {
    updateUniformRadius,
    commitUniformRadius,
    setBlendMode,
    toggleVisibility,
    toggleIndependentCorners,
    updateCornerProp,
    commitCornerProp
  }
}
