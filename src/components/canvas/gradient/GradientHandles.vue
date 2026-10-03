<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { computed, onUnmounted, ref, watch } from 'vue'

import {
  createSceneGeometry,
  gradientHandles,
  type GradientHandle,
  type ViewportTransform
} from '@open-pencil/core/geometry'
import type { Vector } from '@open-pencil/scene-graph'
import { useEditorCommands, useI18n } from '@open-pencil/vue'

import { activeGradientEditing, type GradientEditing } from '@/app/editor/gradient/editing'

const { viewport, enabled = true } = defineProps<{
  viewport: ViewportTransform
  enabled?: boolean
}>()
const root = ref<HTMLElement>()
const { panels } = useI18n()
const { runCommand } = useEditorCommands()
let dragging: { pointerId: number; element: HTMLElement; editing: GradientEditing } | null = null
const points = computed(() => {
  const editing = activeGradientEditing.value
  if (!editing || !enabled) return null
  void editing.editor.state.renderVersion
  const current = editing.read()
  if (!current) return null
  const geometry = createSceneGeometry(editing.editor.graph)
  const handles = gradientHandles(
    current.fill.type,
    current.transform,
    current.node.width,
    current.node.height
  )
  const toScreen = (point: Vector) => geometry.toScreen(current.node, point, viewport)
  return {
    linear: current.fill.type === 'GRADIENT_LINEAR',
    start: toScreen(handles.start),
    end: toScreen(handles.end),
    center: toScreen(handles.center),
    radiusY: handles.radiusY ? toScreen(handles.radiusY) : null,
    guides: editing.guides.value.map((guide) => ({
      start: toScreen(guide.start),
      end: toScreen(guide.end)
    }))
  }
})
const handles = computed(() => {
  const p = points.value
  if (!p) return []
  const result: Array<{ id: GradientHandle; point: Vector; label: string }> = [
    { id: 'center', point: p.center, label: panels.value.gradientMove }
  ]
  if (p.linear) {
    result.push({ id: 'start', point: p.start, label: panels.value.gradientStart })
    result.push({ id: 'end', point: p.end, label: panels.value.gradientEnd })
  } else {
    result.push({ id: 'radius-x', point: p.end, label: panels.value.gradientRadius })
    if (p.radiusY)
      result.push({ id: 'radius-y', point: p.radiusY, label: panels.value.gradientWidth })
  }
  return result
})
function lineStyle(start: Vector, end: Vector) {
  return {
    left: `${start.x}px`,
    top: `${start.y}px`,
    width: `${Math.hypot(end.x - start.x, end.y - start.y)}px`,
    transform: `rotate(${Math.atan2(end.y - start.y, end.x - start.x)}rad)`
  }
}
function localPoint(event: PointerEvent) {
  const editing = activeGradientEditing.value
  const current = editing?.read()
  const bounds = root.value?.getBoundingClientRect()
  if (!editing || !current || !bounds) return null
  return createSceneGeometry(editing.editor.graph).screenToLocal(
    current.node,
    { x: event.clientX - bounds.left, y: event.clientY - bounds.top },
    viewport
  )
}
function down(handle: GradientHandle, event: PointerEvent) {
  if (event.button !== 0) return
  const position = localPoint(event)
  const element = event.currentTarget
  if (!position || !(element instanceof HTMLElement)) return
  const editing = activeGradientEditing.value
  if (!editing?.begin(handle, position)) return
  event.preventDefault()
  event.stopPropagation()
  element.focus({ preventScroll: true })
  element.setPointerCapture(event.pointerId)
  dragging = { pointerId: event.pointerId, element, editing }
}
function move(event: PointerEvent) {
  if (dragging?.pointerId !== event.pointerId) return
  const position = localPoint(event)
  if (position) dragging.editing.move(position, event.shiftKey, viewport.zoom, event.altKey)
}
function finish(cancel = false) {
  if (!dragging) return
  const previous = dragging
  dragging = null
  if (previous.element.hasPointerCapture(previous.pointerId))
    previous.element.releasePointerCapture(previous.pointerId)
  if (cancel) previous.editing.cancel()
  else previous.editing.commit()
}
function handleHistory(event: KeyboardEvent) {
  if (!(event.metaKey || event.ctrlKey) || event.altKey) return
  if (event.code !== 'KeyZ' && event.code !== 'KeyY') return
  event.preventDefault()
  event.stopPropagation()
  if (dragging) {
    finish(true)
    return
  }
  const redo = event.code === 'KeyY' || event.shiftKey
  runCommand(redo ? 'edit.redo' : 'edit.undo')
}
useEventListener(
  'keydown',
  (event) => {
    if (event.key !== 'Escape' || !dragging) return
    event.preventDefault()
    event.stopImmediatePropagation()
    finish(true)
  },
  { capture: true }
)
useEventListener('blur', () => finish(true))
watch(
  () => [enabled, activeGradientEditing.value],
  () => finish(true)
)
onUnmounted(() => finish(true))
</script>

<template>
  <div
    v-if="points"
    ref="root"
    data-gradient-editor
    class="pointer-events-none absolute inset-0 overflow-hidden"
    @keydown="handleHistory"
  >
    <div
      v-for="(guide, index) in points.guides"
      :key="index"
      data-gradient-snap-guide
      class="absolute h-0 origin-left border-t border-dashed border-accent"
      :style="lineStyle(guide.start, guide.end)"
    />
    <div
      class="absolute h-px origin-left bg-white shadow-[0_0_0_1px_#2563eb]"
      :style="lineStyle(points.start, points.end)"
    />
    <div
      v-if="points.radiusY"
      class="absolute h-px origin-left bg-white shadow-[0_0_0_1px_#2563eb]"
      :style="lineStyle(points.center, points.radiusY)"
    />
    <button
      v-for="handle in handles"
      :key="handle.id"
      type="button"
      :aria-label="handle.label"
      :data-gradient-handle="handle.id"
      class="pointer-events-auto absolute size-3 -translate-x-1/2 -translate-y-1/2 cursor-move touch-none rounded-full border-2 border-accent bg-white shadow-sm focus-visible:ring-2 focus-visible:ring-accent"
      :style="{ left: `${handle.point.x}px`, top: `${handle.point.y}px` }"
      @pointerdown="down(handle.id, $event)"
      @pointermove="move"
      @pointerup="finish()"
      @pointercancel="finish(true)"
      @lostpointercapture="finish(true)"
    />
  </div>
</template>
