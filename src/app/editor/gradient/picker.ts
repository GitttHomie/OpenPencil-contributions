import { tryOnScopeDispose } from '@vueuse/core'
import { watch } from 'vue'

import { useActiveEditorStoreRef } from '@/app/editor/active-store'

import {
  activeGradientEditing,
  createGradientEditing,
  type GradientEditing,
  type GradientTarget
} from './editing'

export function useCanvasGradientPicker(
  isOpen: () => boolean,
  target: () => GradientTarget | undefined,
  beforeGesture: () => void
) {
  const activeEditor = useActiveEditorStoreRef()
  let current: GradientEditing | null = null
  let subscriptions: Array<() => void> = []

  function close() {
    current?.cancel()
    if (activeGradientEditing.value === current) activeGradientEditing.value = null
    current = null
    for (const stop of subscriptions) stop()
    subscriptions = []
  }

  watch(
    [
      isOpen,
      () => target()?.nodeId,
      () => target()?.property,
      () => target()?.index,
      () => activeEditor.value
    ],
    () => {
      close()
      const editor = activeEditor.value
      const next = target()
      if (!isOpen() || !editor || !next) return
      activeGradientEditing.value?.cancel()
      current = createGradientEditing(editor, next, beforeGesture)
      activeGradientEditing.value = current
      for (const event of ['selection:changed', 'page:changed', 'graph:replaced'] as const) {
        subscriptions.push(editor.onEditorEvent(event, close))
      }
      subscriptions.push(
        editor.onEditorEvent('node:deleted', (id) => {
          if (id === next.nodeId) close()
        })
      )
    },
    { immediate: true }
  )
  tryOnScopeDispose(close)
}
