import { assertNodeEditable } from '#core/editor/capabilities'
import type { EditorContext } from '#core/editor/types'

import { assertComponentSetEditable, updateVariantName } from './history'
import { getComponentSet, getComponentSetVariants } from './model'

/** Reorder a displayed subset without moving hidden properties or non-variant children. */
function reorderedSubset(current: string[], requested: string[]): string[] | null {
  const selected = new Set(requested)
  const available = new Set(current)
  if (selected.size !== requested.length || requested.some((id) => !available.has(id))) return null
  let index = 0
  return current.map((id) => (selected.has(id) ? requested[index++] : id))
}

export function reorderPropertyDefinitions(
  ctx: EditorContext,
  ownerId: string,
  propertyIds: string[]
): boolean {
  const owner = ctx.graph.getNode(ownerId)
  if (owner?.type !== 'COMPONENT' && owner?.type !== 'COMPONENT_SET') return false
  assertNodeEditable(ctx.graph, ownerId)
  if (owner.type === 'COMPONENT_SET') assertComponentSetEditable(ctx, ownerId)
  const before = structuredClone(owner.componentPropertyDefinitions)
  const ids = reorderedSubset(
    before.map((definition) => definition.id),
    propertyIds
  )
  if (!ids) return false
  if (ids.every((id, index) => before[index]?.id === id)) return true
  const byId = new Map(before.map((definition) => [definition.id, definition]))
  const after = ids.flatMap((id) => {
    const definition = byId.get(id)
    return definition ? [definition] : []
  })
  const variantOrder = before.filter((definition) => definition.type === 'VARIANT')
  const variantOrderChanged = after
    .filter((definition) => definition.type === 'VARIANT')
    .some((definition, index) => definition.id !== variantOrder[index]?.id)
  const variants = variantOrderChanged ? getComponentSetVariants(ctx.graph, ownerId) : []
  const beforeNames = new Map(variants.map((variant) => [variant.id, variant.name]))
  ctx.graph.updateNode(ownerId, { componentPropertyDefinitions: structuredClone(after) })
  for (const variant of variants) updateVariantName(ctx, ownerId, variant)
  const afterNames = new Map(variants.map((variant) => [variant.id, variant.name]))
  function apply(definitions: typeof before, names: Map<string, string>) {
    ctx.graph.updateNode(ownerId, { componentPropertyDefinitions: structuredClone(definitions) })
    for (const [id, name] of names) ctx.graph.updateNode(id, { name })
    ctx.requestRender()
  }
  ctx.undo.push({
    label: 'Reorder properties',
    forward: () => apply(after, afterNames),
    inverse: () => apply(before, beforeNames)
  })
  ctx.requestRender()
  return true
}

export function reorderVariants(ctx: EditorContext, setId: string, variantIds: string[]): boolean {
  const set = getComponentSet(ctx.graph, setId)
  if (!set) return false
  const variants = new Set(getComponentSetVariants(ctx.graph, setId).map((node) => node.id))
  if (variantIds.length !== variants.size || variantIds.some((id) => !variants.has(id)))
    return false
  const before = [...set.childIds]
  const after = reorderedSubset(before, variantIds)
  if (!after) return false
  assertComponentSetEditable(ctx, setId)
  if (after.every((id, index) => before[index] === id)) return true
  function apply(ids: string[]) {
    ids.forEach((id, index) => ctx.graph.insertChildAt(id, setId, index))
    ctx.runLayoutForNode(setId)
    ctx.requestRender()
  }
  ctx.undo.execute({
    label: 'Reorder variants',
    forward: () => apply(after),
    inverse: () => apply(before)
  })
  return true
}
