import * as v from 'valibot'

import type { RenderResult, TreeNode } from '@open-pencil/design-jsx'

import {
  finishRenderPlacement,
  resolveRenderPlacement,
  type RenderPlacement,
  type RenderPlacementInput
} from '#core/design-jsx/placement'
import type { FigmaAPI } from '#core/figma-api/index'
import { designFeedback, type DesignFeedback } from '#core/tools/design-guidance/feedback'
import { toolNumber } from '#core/tools/input'
import { defineTool } from '#core/tools/schema'

interface ToolRenderResult extends Omit<RenderResult, 'childIds'> {
  children: string[]
  designFeedback?: DesignFeedback[]
  siblings?: Pick<RenderResult, 'id' | 'name' | 'type'>[]
}

async function renderPlaced(
  figma: FigmaAPI,
  args: RenderPlacementInput,
  create: (placement: RenderPlacement) => Promise<RenderResult[]>
) {
  const placement = resolveRenderPlacement(figma.graph, args, figma.currentPageId)
  const results = await create(placement)
  finishRenderPlacement(figma.graph, results, placement)
  const result = results[0]
  const feedback = designFeedback(
    figma.graph,
    results.map((node) => node.id)
  )
  const response: ToolRenderResult = {
    id: result.id,
    name: result.name,
    type: result.type,
    children: result.childIds
  }
  if (result.warnings) response.warnings = result.warnings
  if (feedback.length) response.designFeedback = feedback
  if (results.length > 1) {
    response.siblings = results
      .slice(1)
      .map((node) => ({ id: node.id, name: node.name, type: node.type }))
  }
  return response
}

/** MCP parses JSX before crossing into the WebView; preserve the normal render tool contract. */
export async function renderDesignTree(
  figma: FigmaAPI,
  tree: TreeNode,
  args: RenderPlacementInput
) {
  const { renderRoots } = await import('#core/design-jsx/index')
  return renderPlaced(figma, args, (placement) => renderRoots(figma.graph, tree, placement))
}

export const render = defineTool({
  name: 'render',

  description:
    'Create editable design nodes from JSX. Required argument: jsx (a string containing the complete JSX). Payload: {"jsx":"<Frame name=\\"Card\\" w={320} h={200} />"}. When using a tool dispatcher, put this entire payload in its arguments field. Use replace_id to replace a placeholder while preserving its position. Supports inline SVG, including open stroked paths.',
  execution: { kind: 'async', mutation: 'document' },
  input: v.object({
    jsx: v.pipe(
      v.string(),
      v.description('Required JSX source string, for example <Frame name="Card" w={320} h={200} />')
    ),
    replace_id: v.optional(
      v.pipe(
        v.string(),
        v.description(
          'Node ID to replace — new node takes its position in parent, old node is deleted'
        )
      )
    ),
    parent_id: v.optional(v.pipe(v.string(), v.description('Parent node ID to render into'))),
    insert_index: v.optional(
      toolNumber(
        v.pipe(
          v.number(),
          v.description('Position among siblings (0 = first child). Omit to append at end.')
        )
      )
    ),
    x: v.optional(toolNumber(v.pipe(v.number(), v.description('X position of the root node')))),
    y: v.optional(toolNumber(v.pipe(v.number(), v.description('Y position of the root node'))))
  }),
  execute: async (figma, args) => {
    const { renderJSX } = await import('#core/design-jsx/index')

    return renderPlaced(figma, args, (placement) => renderJSX(figma.graph, args.jsx, placement))
  }
})
