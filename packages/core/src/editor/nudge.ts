import { isEqual } from 'es-toolkit'

import { fitEnclosingGroups } from '@open-pencil/scene-graph'
import type { SceneNode } from '@open-pencil/scene-graph'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import Matrix from '@open-pencil/scene-graph/matrix'

import { getNodeEditCapability } from './capabilities'
import { applyMoveStates, captureMoveState, type MoveState } from './history/move'
import { recordPositionOverrides } from './history/position'
import { snapGeometryChanges } from './pixel-snapping'
import type { EditorContext } from './types'

const NUDGE_COMMIT_DELAY = 300

function nudgePosition(
  ctx: EditorContext,
  node: SceneNode,
  parent: SceneNode | undefined,
  dx: number,
  dy: number
) {
  const inverse = parent ? Matrix.invert(getWorldMatrix(parent, ctx.graph)) : null
  const origin = inverse ? Matrix.mapPoint(inverse, { x: 0, y: 0 }) : { x: 0, y: 0 }
  const target = inverse ? Matrix.mapPoint(inverse, { x: dx, y: dy }) : { x: dx, y: dy }
  ctx.graph.updateNode(
    node.id,
    snapGeometryChanges(
      {
        x: node.x + target.x - origin.x,
        y: node.y + target.y - origin.y
      },
      ctx.state.snappingPreferences.pixelGrid
    )
  )
}

function layoutDirection(ctx: EditorContext, node: SceneNode): 'LTR' | 'RTL' {
  let current: SceneNode | undefined = node
  while (current) {
    if (current.layoutDirection !== 'AUTO') return current.layoutDirection
    current = current.parentId ? ctx.graph.getNode(current.parentId) : undefined
  }
  return 'LTR'
}

function movableSelection(ctx: EditorContext): Set<string> {
  return new Set(
    [...ctx.state.selectedIds].filter((id) => {
      let node = ctx.graph.getNode(id)
      if (!node || !getNodeEditCapability(ctx.graph, id).editable) return false
      while (node) {
        if (node.locked) return false
        if (node.id !== id && ctx.state.selectedIds.has(node.id)) return false
        node = node.parentId ? ctx.graph.getNode(node.parentId) : undefined
      }
      return true
    })
  )
}

function reorderedChildren(
  ctx: EditorContext,
  parent: SceneNode,
  selected: ReadonlySet<string>,
  dx: number,
  dy: number
): string[] {
  const children = ctx.graph.getChildren(parent.id)
  const flow = children.filter((node) => node.visible && node.layoutPositioning !== 'ABSOLUTE')
  const rtl = layoutDirection(ctx, parent) === 'RTL'
  const main = parent.layoutMode === 'HORIZONTAL' ? dx : dy
  let delta = Math.sign(main) * (parent.layoutMode === 'HORIZONTAL' && rtl ? -1 : 1)
  if (parent.layoutMode === 'GRID') {
    delta = dy
      ? Math.sign(dy) * Math.max(1, parent.gridTemplateColumns.length)
      : Math.sign(dx) * (rtl ? -1 : 1)
  }
  if (!delta) return parent.childIds

  const order = flow.map((node) => node.id)
  for (let step = 0; step < Math.abs(delta); step++) {
    const direction = Math.sign(delta)
    for (
      let i = direction > 0 ? order.length - 2 : 1;
      direction > 0 ? i >= 0 : i < order.length;
      i -= direction
    ) {
      const next = i + direction
      if (selected.has(order[i]) && !selected.has(order[next])) {
        ;[order[i], order[next]] = [order[next], order[i]]
      }
    }
  }
  let index = 0
  return children.map((node) =>
    node.visible && node.layoutPositioning !== 'ABSOLUTE' ? order[index++] : node.id
  )
}

function fitNudgedGroups(ctx: EditorContext, before: Map<string, MoveState>) {
  const parents = [...before.values()].map((state) => state.parentId)
  const fit = fitEnclosingGroups(ctx.graph, parents)
  for (const [id, placement] of fit?.before ?? []) {
    const node = ctx.graph.getNode(id)
    if (node && !before.has(id))
      before.set(id, { ...captureMoveState(ctx.graph, node), ...placement })
  }
}

export function createNudgeActions(ctx: EditorContext) {
  let sequence = 0
  let previousTime = 0
  let previousSelection = ''

  function flushNudge() {
    sequence++
    previousTime = 0
  }

  function nudgeSelected(dx: number, dy: number) {
    if (!dx && !dy) return
    const selected = movableSelection(ctx)
    if (selected.size === 0) return
    const before = new Map<string, MoveState>()
    const layoutParents = new Set<string>()
    const remember = (node: SceneNode) => {
      if (!before.has(node.id)) before.set(node.id, captureMoveState(ctx.graph, node))
    }

    for (const id of selected) {
      const node = ctx.graph.getNode(id)
      if (!node) continue
      const parent = node.parentId ? ctx.graph.getNode(node.parentId) : undefined
      if (parent && parent.layoutMode !== 'NONE' && node.layoutPositioning !== 'ABSOLUTE') {
        layoutParents.add(parent.id)
        continue
      }
      remember(node)
      nudgePosition(ctx, node, parent, dx, dy)
    }
    for (const parentId of layoutParents) {
      const parent = ctx.graph.getNode(parentId)
      if (!parent) continue
      const next = reorderedChildren(ctx, parent, selected, dx, dy)
      if (isEqual(next, parent.childIds)) continue
      for (const node of ctx.graph.getChildren(parentId)) remember(node)
      next.forEach((id, index) => ctx.graph.reorderChild(id, parentId, index))
      ctx.runLayoutForNode(parentId)
    }
    if (before.size === 0) return
    fitNudgedGroups(ctx, before)
    const after = new Map<string, MoveState>()
    for (const id of before.keys()) {
      const node = ctx.graph.getNode(id)
      if (node) after.set(id, captureMoveState(ctx.graph, node))
    }
    const now = Date.now()
    const selection = JSON.stringify([[...selected].sort(), [...before.keys()].sort()])
    if (now - previousTime > NUDGE_COMMIT_DELAY || selection !== previousSelection) sequence++
    previousTime = now
    previousSelection = selection
    const overrides = recordPositionOverrides(ctx, before, after)
    // Record immediately so Undo works even before the key-repeat sequence settles.
    ctx.undo.push({
      label: layoutParents.size ? 'Reorder' : 'Nudge',
      coalesceKey: `nudge-${sequence}`,
      forward: () => {
        applyMoveStates(ctx, after)
        overrides.redo()
      },
      inverse: () => {
        applyMoveStates(ctx, before)
        overrides.undo()
      }
    })
    ctx.requestRender()
  }

  return { nudgeSelected, flushNudge }
}
