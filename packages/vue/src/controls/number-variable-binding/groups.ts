import type { Editor } from '@open-pencil/core/editor'
import { sharedNumberGroup } from '@open-pencil/scene-graph'

import type { BindingTarget } from '#vue/controls/binding-provider/types'

export function numberBindingTarget(editor: Editor, target: BindingTarget): BindingTarget {
  const node = editor.getNode(target.nodeId)
  const group = node && sharedNumberGroup(node, target.path)
  return group ? { ...target, path: group.shared } : target
}

export function prepareNumberTargets(editor: Editor, targets: BindingTarget[]) {
  for (const target of targets) editor.prepareNumberProperty(target.nodeId, target.path)
}
