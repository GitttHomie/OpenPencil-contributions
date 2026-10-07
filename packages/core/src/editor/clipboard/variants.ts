import { updateVariantName } from '#core/editor/components/variants/history'
import { getVariantDefinitions, getVariantOptions } from '#core/editor/components/variants/model'
import type { EditorContext } from '#core/editor/types'

/** Pasted definitions become variants using the destination's displayed value order. */
export function initializePastedVariants(ctx: EditorContext, ids: string[]) {
  for (const id of ids) {
    const node = ctx.graph.getNode(id)
    const set = node?.parentId ? ctx.graph.getNode(node.parentId) : undefined
    if (node?.type !== 'COMPONENT' || set?.type !== 'COMPONENT_SET') continue
    const values = Object.fromEntries(
      getVariantDefinitions(ctx.graph, set.id).map((property) => [
        property.name,
        getVariantOptions(ctx.graph, set.id, property.id)[0] ?? property.defaultValue
      ])
    )
    ctx.graph.updateNode(id, {
      componentPropertyValues: { ...node.componentPropertyValues, ...values }
    })
    updateVariantName(ctx, set.id, node)
  }
}
