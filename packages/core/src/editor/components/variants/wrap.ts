import { createComponentPropertyId, type SceneNode } from '@open-pencil/scene-graph'

import { assertNodeEditable } from '#core/editor/capabilities'
import { applyVariantProperties, variantSetProps } from '#core/editor/components/variant-set'
import { wrapParentId, wrapSelectionInContainer } from '#core/editor/structure/container-wrap'
import type { EditorContext } from '#core/editor/types'

/** Wrap definitions without replacing their ids, so existing instances keep their source. */
export function createVariantSet(ctx: EditorContext, nodes: SceneNode[]): string | undefined {
  if (!nodes.length || nodes.some((node) => node.type !== 'COMPONENT')) return undefined
  const parentId = wrapParentId(ctx, nodes)
  if (!parentId || ctx.graph.getNode(parentId)?.type === 'COMPONENT_SET') return undefined
  for (const node of nodes) assertNodeEditable(ctx.graph, node.id)
  let setId: string | undefined
  ctx.undo.runBatch('Create component set', () => {
    const sorted = nodes.toSorted((a, b) => a.x - b.x || a.y - b.y)
    const id = wrapSelectionInContainer(
      ctx,
      'COMPONENT_SET',
      sorted,
      variantSetProps(ctx.graph, sorted, parentId, 'canvas')
    )
    if (!id) return
    setId = id
    const set = ctx.graph.getNode(id)
    if (!set) return
    const before = nodes.map((node) => ({
      id: node.id,
      name: node.name,
      componentPropertyValues: structuredClone(node.componentPropertyValues),
      componentPropertyDefinitions: structuredClone(node.componentPropertyDefinitions)
    }))
    applyVariantProperties(ctx.graph, sorted, id)
    if (!set.componentPropertyDefinitions.some((definition) => definition.type === 'VARIANT')) {
      const name = 'Variant'
      const options = nodes.map((_, index) => (index === 0 ? 'Default' : `Variant ${index + 1}`))
      ctx.graph.updateNode(id, {
        componentPropertyDefinitions: [
          {
            id: createComponentPropertyId(),
            name,
            type: 'VARIANT',
            defaultValue: options[0],
            variantOptions: options
          }
        ]
      })
      nodes.forEach((node, index) =>
        ctx.graph.updateNode(node.id, {
          name: `${name}=${options[index]}`,
          componentPropertyValues: { [name]: options[index] }
        })
      )
    }
    // A standalone component's existing properties become shared with its new variants.
    if (nodes.length === 1) {
      ctx.graph.updateNode(id, {
        componentPropertyDefinitions: [
          ...set.componentPropertyDefinitions,
          ...before[0].componentPropertyDefinitions
        ]
      })
      ctx.graph.updateNode(nodes[0].id, { componentPropertyDefinitions: [] })
    }
    const definitions = structuredClone(set.componentPropertyDefinitions)
    const after = nodes.map((node) => ({
      id: node.id,
      name: node.name,
      componentPropertyValues: structuredClone(node.componentPropertyValues),
      componentPropertyDefinitions: structuredClone(node.componentPropertyDefinitions)
    }))
    const apply = (values: typeof before) => {
      for (const { id, ...changes } of values) ctx.graph.updateNode(id, structuredClone(changes))
      ctx.runLayoutForNode(set.id)
      ctx.requestRender()
    }
    ctx.undo.push({
      label: 'Configure variants',
      forward: () => {
        ctx.graph.updateNode(set.id, { componentPropertyDefinitions: structuredClone(definitions) })
        apply(after)
      },
      inverse: () => apply(before)
    })
    ctx.runLayoutForNode(id)
    ctx.requestRender()
  })
  return setId
}
