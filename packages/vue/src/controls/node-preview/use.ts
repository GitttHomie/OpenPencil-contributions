import { tryOnScopeDispose } from '@vueuse/core'
import { getCurrentInstance, onDeactivated } from 'vue'

import type { Editor, NodePreview } from '@open-pencil/core/editor'
import type { SceneNode } from '@open-pencil/scene-graph'

/** Keeps an edit's original targets until its terminal event, even after selection changes. */
export function useNodePreview(editor: Editor) {
  let preview: NodePreview | undefined
  let targets: readonly string[] = []

  function update(
    ids: readonly string[],
    changes: Partial<SceneNode> | ((id: string) => Partial<SceneNode>),
    label: string
  ) {
    if (!preview) {
      if (!ids.length) return
      targets = [...ids]
      preview = editor.beginNodePreview(label)
    }
    try {
      const updates = targets.map((id) => ({
        id,
        changes: typeof changes === 'function' ? changes(id) : changes
      }))
      for (const update of updates) preview.update(update.id, update.changes)
    } catch (error) {
      cancel()
      throw error
    }
  }

  function takePreview() {
    const current = preview
    preview = undefined
    targets = []
    return current
  }

  function commit() {
    takePreview()?.commit()
  }

  function cancel() {
    takePreview()?.cancel()
  }

  tryOnScopeDispose(cancel)
  if (getCurrentInstance()) onDeactivated(cancel)
  return { update, commit, cancel }
}
