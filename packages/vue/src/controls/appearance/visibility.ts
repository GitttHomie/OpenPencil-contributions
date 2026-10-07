import type { Editor } from '@open-pencil/core/editor'
import { componentPropertyEditTarget } from '@open-pencil/core/editor'
import type { SceneNode } from '@open-pencil/scene-graph'

export function visibilityPropertyReference(node: SceneNode) {
  return node.componentPropertyReferences.find((reference) => reference.field === 'VISIBLE')
}

export function visibilityPropertyName(editor: Editor, node: SceneNode): string | null {
  const reference = visibilityPropertyReference(node)
  if (!reference) return null
  return (
    componentPropertyEditTarget(editor.graph, node.id, 'VISIBLE')?.propertyName ??
    reference.propertyId
  )
}
