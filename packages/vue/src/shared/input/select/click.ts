import type { Editor } from '@open-pencil/core/editor'

import type { HitTestFns } from '#vue/shared/input/select'
import { drillHit, resolveLabelHit } from '#vue/shared/input/select/hit'
import type { DragMove } from '#vue/shared/input/types'

export function createSelectionClick(editor: Editor, fns: HitTestFns) {
  let pending: { parentId: string; childId: string } | null = null

  function prepare(event: MouseEvent, cx: number, cy: number) {
    pending = null
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      editor.state.activeTool !== 'SELECT' ||
      editor.state.editingTextId ||
      editor.state.nodeEditState ||
      resolveLabelHit(cx, cy, fns)
    ) {
      return
    }
    const child = drillHit(editor, fns.hitTestInScope(cx, cy, true))
    if (child?.parentId) pending = { parentId: child.parentId, childId: child.id }
  }

  function finish(drag: DragMove): boolean {
    const click = pending
    pending = null
    if (
      !click ||
      drag.dragStarted ||
      drag.duplicated ||
      (drag.isCurrentGraph && !drag.isCurrentGraph()) ||
      editor.state.selectedIds.size !== 1 ||
      !editor.state.selectedIds.has(click.parentId) ||
      editor.graph.getNode(click.childId)?.parentId !== click.parentId
    ) {
      return false
    }
    editor.enterContainer(click.parentId)
    editor.select([click.childId])
    return true
  }

  return { prepare, finish }
}
