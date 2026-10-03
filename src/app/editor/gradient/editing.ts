import { shallowRef } from 'vue'

import type { Editor, NodePreview } from '@open-pencil/core/editor'
import {
  gradientHandles,
  moveGradientHandle,
  snapGradientPoint,
  type GradientHandle,
  type GradientSnapGuide
} from '@open-pencil/core/geometry'
import type { Fill, GradientTransform, Vector } from '@open-pencil/scene-graph'
import { copyFills } from '@open-pencil/scene-graph/copy'

export interface GradientTarget {
  nodeId: string
  fillIndex: number
}

export function createGradientEditing(
  editor: Editor,
  target: GradientTarget,
  beforeGesture: () => void
) {
  const guides = shallowRef<GradientSnapGuide[]>([])
  let preview: NodePreview | null = null
  let gesture: {
    handle: GradientHandle
    transform: GradientTransform
    fills: Fill[]
    offset: Vector
    width: number
    height: number
    type: Fill['type']
  } | null = null

  function read() {
    const node = editor.graph.getNode(target.nodeId)
    const fill = node?.fills[target.fillIndex]
    if (!node || !fill?.type.startsWith('GRADIENT') || !fill.gradientTransform) return null
    return { node, fill, transform: fill.gradientTransform }
  }

  function cancel() {
    guides.value = []
    preview?.cancel()
    preview = null
    gesture = null
  }

  function begin(handle: GradientHandle, position: Vector) {
    cancel()
    beforeGesture()
    const current = read()
    if (!current || current.node.width <= 0 || current.node.height <= 0) return false
    const { node, fill, transform } = current
    const handles = gradientHandles(fill.type, transform, node.width, node.height)
    const origins: Record<GradientHandle, Vector> = {
      center: handles.center,
      start: handles.start,
      end: handles.end,
      'radius-x': handles.end,
      'radius-y': handles.radiusY ?? handles.center
    }
    const origin = origins[handle]
    gesture = {
      handle,
      transform: { ...transform },
      fills: copyFills(node.fills),
      offset: { x: position.x - origin.x, y: position.y - origin.y },
      width: node.width,
      height: node.height,
      type: fill.type
    }
    preview = editor.beginNodePreview('Edit gradient')
    return true
  }

  function move(position: Vector, snap = false, zoom = 1, disabled = false) {
    if (!gesture || !preview || preview.closed) return
    const { handle, transform, fills, offset, width, height, type } = gesture
    const handles = gradientHandles(type, transform, width, height)
    let origin: Vector | null = handles.center
    if (handle === 'center') origin = null
    else if (handle === 'start') origin = handles.end
    else if (handle === 'end') origin = handles.start
    const snapped = snapGradientPoint(
      { x: position.x - offset.x, y: position.y - offset.y },
      origin,
      width,
      height,
      { zoom, constrain: snap, disabled }
    )
    guides.value = snapped.guides
    const next = moveGradientHandle(type, transform, width, height, handle, snapped.position)
    const nextFills = copyFills(fills)
    const fill = nextFills.at(target.fillIndex)
    if (!fill) return
    fill.gradientTransform = next
    preview.update(target.nodeId, { fills: nextFills })
  }

  function commit() {
    guides.value = []
    preview?.commit()
    preview = null
    gesture = null
  }

  return { editor, target, read, begin, move, commit, cancel, guides }
}

export type GradientEditing = ReturnType<typeof createGradientEditing>
export const activeGradientEditing = shallowRef<GradientEditing | null>(null)
