import { type SceneNode } from '@open-pencil/scene-graph'
import { buildVariantName } from '@open-pencil/scene-graph/variant-name'

import { assertNodeEditable } from '#core/editor/capabilities'
import { VARIANT_SET_PADDING } from '#core/editor/components/variant-set'
import { restoreSubtree, snapshotSubtree } from '#core/editor/history/subtree'
import type { EditorContext } from '#core/editor/types'

import {
  getComponentSet,
  getComponentSetVariants,
  getVariantDefinitions,
  getVariantOptions
} from './model'

type SetFields = Pick<
  SceneNode,
  'componentPropertyDefinitions' | 'width' | 'height' | 'derivedLayout'
>
function setFields(node: SceneNode): SetFields {
  return {
    componentPropertyDefinitions: structuredClone(node.componentPropertyDefinitions),
    width: node.width,
    height: node.height,
    derivedLayout: structuredClone(node.derivedLayout)
  }
}

/** The first `Variant2`, `Variant3`, … no variant of the property uses yet, as Figma names them. */
function nextVariantValue(options: readonly string[]): string {
  const taken = new Set(options)
  let index = 2
  while (taken.has(`Variant${index}`)) index++
  return `Variant${index}`
}

/**
 * Copy `source` after the set's last variant. A set with auto layout places the copy itself; one
 * without, as Figma makes them, gets it 20 below the last variant and grows to hold it. With
 * `nextValue`, the copy takes the next free value of the set's first variant property, as Figma's
 * Add variant does; without, it keeps the source's values for the caller to change.
 */
export function appendVariant(
  ctx: EditorContext,
  setId: string,
  source: SceneNode,
  nextValue: boolean
): string | undefined {
  const set = getComponentSet(ctx.graph, setId)
  const definition = getVariantDefinitions(ctx.graph, setId).at(0)
  if (!set || (nextValue && !definition)) return undefined
  assertNodeEditable(ctx.graph, source.id)
  const variants = getComponentSetVariants(ctx.graph, setId)
  const bottom = Math.max(...variants.map((variant) => variant.y + variant.height))
  const value =
    definition && nextValue
      ? nextVariantValue(getVariantOptions(ctx.graph, setId, definition.id))
      : null
  const values =
    definition && value
      ? { ...source.componentPropertyValues, [definition.name]: value }
      : source.componentPropertyValues
  const ordered = Object.fromEntries(
    getVariantDefinitions(ctx.graph, setId).map((item) => [item.name, values[item.name] ?? ''])
  )
  const laidOut = set.layoutMode !== 'NONE'
  const fields: Partial<SceneNode> = {
    name: buildVariantName(ordered),
    componentPropertyValues: values,
    // A new layer has no geometry a file saved for it; the source's would pin it in place.
    derivedLayout: null
  }
  if (!laidOut) {
    fields.x = source.x
    fields.y = bottom + VARIANT_SET_PADDING
  }
  const clone = ctx.graph.cloneTree(source.id, setId, fields)
  if (!clone) return undefined
  const setBefore = setFields(set)
  const setAfter: SetFields = {
    componentPropertyDefinitions: set.componentPropertyDefinitions.map((item) =>
      value && item.id === definition?.id
        ? { ...item, variantOptions: [...(item.variantOptions ?? []), value] }
        : item
    ),
    width: laidOut ? set.width : Math.max(set.width, clone.x + clone.width + VARIANT_SET_PADDING),
    height: laidOut
      ? set.height
      : Math.max(set.height, clone.y + clone.height + VARIANT_SET_PADDING),
    derivedLayout: laidOut ? null : set.derivedLayout
  }
  // Auto layout sizes the set and places the copy; the stored size is only a starting point.
  const apply = (fields: SetFields) => {
    ctx.graph.updateNode(setId, structuredClone(fields))
    if (laidOut) ctx.runLayoutForNode(setId)
  }
  apply(setAfter)
  const snapshots = snapshotSubtree(ctx.graph, clone.id)
  ctx.setSelectedIds(new Set([clone.id]))
  ctx.undo.push({
    label: 'Add variant',
    forward: () => {
      const root = snapshots.get(clone.id)
      if (root) restoreSubtree(ctx.graph, root, setId, snapshots)
      apply(setAfter)
      ctx.setSelectedIds(new Set([clone.id]))
      ctx.requestRender()
    },
    inverse: () => {
      ctx.graph.deleteNode(clone.id)
      apply(setBefore)
      ctx.setSelectedIds(new Set([source.id]))
      ctx.requestRender()
    }
  })
  ctx.requestRender()
  return clone.id
}
