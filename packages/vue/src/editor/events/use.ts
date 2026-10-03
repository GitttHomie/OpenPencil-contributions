import { watchEffect } from 'vue'

import type { EditorEventName, EditorEvents } from '@open-pencil/core/editor'

import { useEditor } from '#vue/editor/context'

export function useEditorEvent<K extends EditorEventName>(event: K, handler: EditorEvents[K]) {
  const editor = useEditor()
  return watchEffect((onCleanup) => onCleanup(editor.onEditorEvent(event, handler)), {
    flush: 'sync'
  })
}
