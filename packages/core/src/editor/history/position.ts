import {
  cloneInstanceOverrideState,
  findInstanceAncestor,
  recordInstanceOverride,
  type InstanceOverrideState
} from '@open-pencil/scene-graph'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import type { EditorContext } from '#core/editor/types'

export function collectNodePositions(
  ctx: EditorContext,
  ids: Iterable<string>
): Map<string, Vector> {
  const positions = new Map<string, Vector>()
  for (const id of ids) {
    const node = ctx.graph.getNode(id)
    if (node) positions.set(id, { x: node.x, y: node.y })
  }
  return positions
}

export function pushPositionUndo(
  ctx: EditorContext,
  label: string,
  originals: Map<string, Vector>,
  finals: Map<string, Vector>
): void {
  const overrides = recordPositionOverrides(ctx, originals, finals)
  ctx.undo.push({
    label,
    forward: () => {
      applyPositions(ctx, finals)
      overrides.redo()
    },
    inverse: () => {
      applyPositions(ctx, originals)
      overrides.undo()
    }
  })
}

/** Position gestures preserve instance edits and restore inheritance on Undo. */
export function recordPositionOverrides(
  ctx: EditorContext,
  originals: ReadonlyMap<string, Vector>,
  finals: ReadonlyMap<string, Vector>
) {
  const previous = new Map<string, InstanceOverrideState>()
  const changes = new Map<string, string[]>()
  for (const [id, final] of finals) {
    const original = originals.get(id)
    if (!original) continue
    const fields = (['x', 'y'] as const).filter((field) => original[field] !== final[field])
    const owner = findInstanceAncestor(ctx.graph, id)
    if (!owner || !fields.length) continue
    if (!previous.has(owner.id))
      previous.set(owner.id, cloneInstanceOverrideState(owner.instanceOverrides))
    changes.set(id, fields)
  }
  for (const [id, fields] of changes) recordInstanceOverride(ctx.graph, id, fields)
  const next = new Map<string, InstanceOverrideState>()
  for (const id of previous.keys()) {
    const owner = ctx.graph.getNode(id)
    if (owner) next.set(id, cloneInstanceOverrideState(owner.instanceOverrides))
  }
  const restore = (states: Map<string, InstanceOverrideState>) => {
    for (const [id, state] of states)
      ctx.graph.updateNode(id, { instanceOverrides: cloneInstanceOverrideState(state) })
  }
  return {
    redo: () => restore(next),
    undo: () => restore(previous)
  }
}

function applyPositions(ctx: EditorContext, positions: Map<string, Vector>): void {
  for (const [id, pos] of positions) {
    ctx.graph.updateNode(id, pos)
    ctx.runLayoutForNode(id)
  }
}
