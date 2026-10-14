import type { Editor } from '@open-pencil/core/editor'
import {
  createSceneGeometry,
  pressesTinyLayer,
  selectionHandleRect
} from '@open-pencil/core/geometry'
import type { SceneNode } from '@open-pencil/scene-graph'

import type { HitTestFns } from '#vue/shared/input/select'
import { selectionAtScope } from '#vue/shared/input/select/scope'

/** The layer whose label is under a point; labels are drawn frames first, so the topmost is first. */
export function hitTestLabel(
  cx: number,
  cy: number,
  fns: Pick<HitTestFns, 'hitTestComponentLabel' | 'hitTestSectionTitle' | 'hitTestFrameTitle'>
): SceneNode | null {
  return (
    fns.hitTestComponentLabel(cx, cy) ??
    fns.hitTestSectionTitle(cx, cy) ??
    fns.hitTestFrameTitle(cx, cy)
  )
}

/** A selected layer too small for handles that takes a press near it, as Figma widens it. */
export function tinySelectionAt(cx: number, cy: number, editor: Editor): SceneNode | null {
  const geometry = createSceneGeometry(editor.graph, editor.state.rotationPreview)
  const zoom = editor.renderer?.zoom ?? 1
  for (const id of editor.state.selectedIds) {
    const node = editor.graph.getNode(id)
    const point = node && geometry.toLocal(node, { x: cx, y: cy })
    if (node && point && pressesTinyLayer(point, selectionHandleRect(node), zoom)) return node
  }
  return null
}

/** Keep an existing selection under the visible leaf when beginning a drag or text edit. */
export function selectedHit(editor: Editor, leaf: SceneNode | null): SceneNode | null {
  if (!leaf) return null
  return editor.graph.closest(leaf.id, (node) => editor.state.selectedIds.has(node.id)) ?? null
}

/** The next child a click can select, without changing the target of a drag. */
export function drillHit(editor: Editor, leaf: SceneNode | null): SceneNode | null {
  if (editor.state.selectedIds.size !== 1) return null
  const parent = selectedHit(editor, leaf)
  if (!parent || parent.locked || !editor.graph.isContainer(parent.id)) return null
  return selectionAtScope(editor.graph, leaf, parent.id)
}

export function resolveHit(
  cx: number,
  cy: number,
  editor: Editor,
  fns: HitTestFns
): SceneNode | null {
  const titleHit = hitTestLabel(cx, cy, fns)
  if (titleHit) return titleHit

  const leaf = fns.hitTestInScope(cx, cy, true)
  const selected = selectedHit(editor, leaf)
  if (selected) return selected

  const hit = fns.hitTestInScope(cx, cy, false)
  if (hit) return hit

  while (editor.state.enteredContainerId) {
    const scopeId = editor.state.enteredContainerId
    if (fns.isInsideContainerBounds(cx, cy, scopeId) && (!leaf || leaf.id === scopeId)) {
      editor.clearSelection()
      return null
    }
    editor.exitContainer()
    const afterExit = fns.hitTestInScope(cx, cy, false)
    if (afterExit) return afterExit
  }
  return null
}
