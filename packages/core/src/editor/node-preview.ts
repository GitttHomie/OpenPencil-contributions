import { isEqual, pick, uniq } from 'es-toolkit'

import type { SceneNode } from '@open-pencil/scene-graph'

import { assertNodeEditable } from './capabilities'
import type { EditorContext } from './types'

export interface NodePreview {
  readonly closed: boolean
  update: (id: string, changes: Partial<SceneNode>) => void
  commit: () => void
  cancel: () => void
}

const PREVIEW_IMPLICIT_FIELDS = new Set<keyof SceneNode>([
  'source',
  'derivedLayout',
  'derivedTextGlyphs',
  'instanceOverrides'
])

function hasAuthoredChange(before: Partial<SceneNode>, node: SceneNode): boolean {
  return (Object.keys(before) as (keyof SceneNode)[]).some(
    (key) => !PREVIEW_IMPLICIT_FIELDS.has(key) && !isEqual(before[key], node[key])
  )
}

/** One owned numeric/property edit, including every node changed by its layout. */
export function createNodePreviewActions(
  ctx: EditorContext,
  updateNode: (id: string, changes: Partial<SceneNode>) => void
) {
  let current: NodePreview | null = null

  function cancelNodePreviews() {
    current?.cancel()
  }

  function beginNodePreview(label = 'Update'): NodePreview {
    cancelNodePreviews()
    const graph = ctx.graph
    const originals = new Map<string, Partial<SceneNode>>()
    const targets = new Set<string>()
    const layoutOnly = new Set<string>()
    const editedBefore = new Map<string, string[]>()
    let closed = false
    let endInteraction: (() => void) | undefined
    const subscriptions: Array<() => void> = []

    function capture(node: SceneNode, changes: Partial<SceneNode>) {
      if (!originals.has(node.id) && graph.isApplyingLayout) layoutOnly.add(node.id)
      if (!graph.isApplyingLayout) {
        layoutOnly.delete(node.id)
      }
      const previous = originals.get(node.id) ?? {}
      if (!graph.isApplyingLayout && !previous.source)
        previous.source = structuredClone(node.source)
      const keys = (Object.keys(changes) as (keyof SceneNode)[]).filter(
        (key) => !Object.hasOwn(previous, key)
      )
      if (keys.length) Object.assign(previous, structuredClone(pick(node, keys)))
      originals.set(node.id, previous)
      if (!graph.isApplyingLayout) markEdited(node, changes)
    }

    // Fields count as edited while previewed, as a committed edit marks them, so the preview's
    // own layout stops keeping geometry a file saved; cancel takes the marks back.
    function markEdited(node: SceneNode, changes: Partial<SceneNode>) {
      if (graph.isPreservingSourceMetadata) return
      if (!editedBefore.has(node.id)) editedBefore.set(node.id, node.source.editedFields)
      node.source.editedFields = uniq([
        ...node.source.editedFields,
        ...Object.keys(changes).filter((key) => key !== 'source')
      ])
    }

    function close() {
      closed = true
      for (const stop of subscriptions) stop()
      endInteraction?.()
      if (current === preview) current = null
    }

    const preview: NodePreview = {
      get closed() {
        return closed
      },
      update(id, changes) {
        if (closed || graph !== ctx.graph || !graph.getNode(id)) return
        targets.add(id)
        endInteraction ??= ctx.beginInteractiveEdit()
        try {
          assertNodeEditable(graph, id)
          graph.runPreviewUpdates(() => updateNode(id, changes), capture)
          ctx.requestRepaint()
        } catch (error) {
          preview.cancel()
          throw error
        }
      },
      commit() {
        if (closed) return
        try {
          for (const id of targets) assertNodeEditable(graph, id)
        } catch (error) {
          preview.cancel()
          throw error
        }
        if (
          ![...targets].some((id) => {
            const before = originals.get(id)
            const node = graph.getNode(id)
            return before && node && hasAuthoredChange(before, node)
          })
        ) {
          preview.cancel()
          return
        }
        const edits: Array<{ id: string; before: Partial<SceneNode>; after: Partial<SceneNode> }> =
          []
        for (const [id, before] of originals) {
          const node = graph.getNode(id)
          if (!node) continue
          const after: Partial<SceneNode> = structuredClone(
            pick(node, Object.keys(before) as (keyof SceneNode)[])
          )
          if (!isEqual(before, after)) {
            // Preview updates don't mark authored fields. Keep that provenance in the
            // committed snapshot, rather than overwriting it with a saved source object.
            if (targets.has(id)) {
              before.source ??= structuredClone(node.source)
              const source = after.source ?? node.source
              after.source = {
                ...source,
                editedFields: [
                  ...new Set([
                    ...source.editedFields,
                    ...Object.keys(after).filter((key) => key !== 'source')
                  ])
                ]
              }
            }
            edits.push({ id, before, after })
          }
        }
        close()
        if (edits.length === 0) {
          if (originals.size) ctx.requestRender()
          return
        }
        function apply(direction: 'before' | 'after') {
          graph.preserveSourceMetadataDuring(() => {
            for (const edit of edits) {
              const update = () => graph.updateNode(edit.id, structuredClone(edit[direction]))
              if (layoutOnly.has(edit.id)) graph.withLayoutMutations(update)
              else update()
            }
          })
          ctx.requestRender()
        }
        ctx.undo.push({ label, forward: () => apply('after'), inverse: () => apply('before') })
        // Publish the complete preview delta, including layout children and implicit edits.
        apply('after')
      },
      cancel() {
        if (closed) return
        close()
        for (const [id, previous] of originals)
          graph.updateNodePreview(id, structuredClone(previous))
        for (const [id, fields] of editedBefore) {
          const node = graph.getNode(id)
          if (node) node.source.editedFields = fields
        }
        // Reconcile retained/tiled resources once; cancellation publishes no committed node edits.
        if (originals.size) ctx.requestRender()
      }
    }
    for (const event of ['selection:changed', 'page:changed', 'graph:replaced'] as const) {
      subscriptions.push(ctx.onEditorEvent(event, preview.cancel))
    }
    subscriptions.push(
      ctx.onEditorEvent('node:deleted', (id) => {
        if (targets.has(id) || originals.has(id)) preview.cancel()
      })
    )
    current = preview
    return preview
  }

  return { beginNodePreview, cancelNodePreviews }
}
