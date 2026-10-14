import { orderBy } from 'es-toolkit/array'
import * as v from 'valibot'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { withBatch } from '#core/tools/batch/define'
import { toolNumber } from '#core/tools/input'
import { defineTool } from '#core/tools/schema'

const MAX_LAYOUTS = 20
const MAX_PAIRS = 12

function visibleFlow(graph: SceneGraph, node: SceneNode): SceneNode[] {
  return graph
    .getChildren(node.id)
    .filter((child) => child.visible && child.opacity > 0 && child.layoutPositioning !== 'ABSOLUTE')
}

/** Inner child boxes, not painted pixels; background fills still occupy their section's box. */
function innerEdges(graph: SceneGraph, node: SceneNode, horizontal: boolean) {
  const children = visibleFlow(graph, node)
  const size = horizontal ? node.width : node.height
  if (children.length === 0 || children.some((child) => child.rotation !== 0))
    return { start: 0, end: size }
  return {
    start: Math.min(...children.map((child) => (horizontal ? child.x : child.y))),
    end: Math.max(
      ...children.map((child) => (horizontal ? child.x + child.width : child.y + child.height))
    )
  }
}

function measureLayout(graph: SceneGraph, node: SceneNode) {
  const horizontal = node.layoutMode === 'HORIZONTAL'
  const children = visibleFlow(graph, node).sort((left, right) =>
    horizontal ? left.x - right.x : left.y - right.y
  )
  const pairs = children.slice(1, MAX_PAIRS + 1).flatMap((after, index) => {
    const before = children[index]
    if (before.rotation !== 0 || after.rotation !== 0) return []
    const beforeStart = horizontal ? before.x : before.y
    const beforeSize = horizontal ? before.width : before.height
    const afterStart = horizontal ? after.x : after.y
    return [
      {
        before: { id: before.id, name: before.name },
        after: { id: after.id, name: after.name },
        boxGap: afterStart - beforeStart - beforeSize,
        innerContentGap:
          afterStart +
          innerEdges(graph, after, horizontal).start -
          beforeStart -
          innerEdges(graph, before, horizontal).end
      }
    ]
  })
  return {
    id: node.id,
    name: node.name,
    direction: node.layoutMode,
    gap: node.itemSpacing,
    padding: [node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft],
    pairs,
    omittedPairs: Math.max(0, children.length - 1 - MAX_PAIRS)
  }
}

export const analyzeSpacing = withBatch(
  defineTool({
    name: 'analyze_spacing',
    description:
      'Analyze gap and padding values in a node or the current page. Reports actual adjacent box gaps and inner content-box gaps (including wrapper whitespace), not painted-pixel distances. Negative gaps can be intentional overlaps. Grid checks run only when a grid is supplied; choose it from this design system.',
    execution: { kind: 'sync', mutation: 'none' },
    input: v.strictObject({
      id: v.optional(v.pipe(v.string(), v.description('Scope to this frame or screen'))),
      grid: v.optional(
        toolNumber(
          v.pipe(
            v.number(),
            v.gtValue(0),
            v.description('Optional base grid size established by this design system')
          )
        )
      )
    }),
    execute: (figma, args) => {
      const gridSize = args.grid
      const page = args.id ? figma.getNodeById(args.id) : figma.currentPage
      if (!page) return { error: `Node "${args.id}" not found` }
      // Geometry getters flush pending script edits before raw graph inspection.
      const scopeWidth = page.width
      const gapMap = new Map<number, number>()
      const paddingMap = new Map<number, number>()
      let totalNodes = 0
      const layouts: ReturnType<typeof measureLayout>[] = []
      let layoutCount = 0

      const inspect = (node: { id: string }) => {
        totalNodes++
        const raw = figma.graph.getNode(node.id)
        if (!raw) return false
        if (
          (raw.layoutMode === 'HORIZONTAL' || raw.layoutMode === 'VERTICAL') &&
          raw.layoutWrap !== 'WRAP'
        ) {
          layoutCount++
          if (layouts.length < MAX_LAYOUTS) layouts.push(measureLayout(figma.graph, raw))
        }

        if (raw.layoutMode !== 'NONE' && raw.itemSpacing > 0) {
          gapMap.set(raw.itemSpacing, (gapMap.get(raw.itemSpacing) ?? 0) + 1)
        }

        for (const padding of [
          raw.paddingTop,
          raw.paddingRight,
          raw.paddingBottom,
          raw.paddingLeft
        ]) {
          if (padding > 0) {
            paddingMap.set(padding, (paddingMap.get(padding) ?? 0) + 1)
          }
        }
        return false
      }
      inspect(page)
      page.findAll(inspect)

      const summarize = (counts: Map<number, number>) =>
        orderBy([...counts.entries()], [(entry) => entry[1]], ['desc']).map(([value, count]) => ({
          value,
          count,
          ...(gridSize ? { onGrid: value % gridSize === 0 } : {})
        }))
      const gaps = summarize(gapMap)
      const paddings = summarize(paddingMap)

      const offGridGaps = gaps.filter((gap) => gap.onGrid === false)
      const offGridPaddings = paddings.filter((padding) => padding.onGrid === false)

      return {
        totalNodes,
        scope: { id: page.id, width: scopeWidth },
        gridSize: gridSize ?? null,
        layouts,
        omittedLayouts: Math.max(0, layoutCount - MAX_LAYOUTS),
        gaps,
        paddings,
        offGridGaps: offGridGaps.map((gap) => gap.value),
        offGridPaddings: offGridPaddings.map((padding) => padding.value)
      }
    }
  }),
  { target: 'id' }
)
