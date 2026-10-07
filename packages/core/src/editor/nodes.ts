import { pick } from 'es-toolkit/object'

import {
  styleDetachmentChanges,
  findInstanceAncestor,
  cloneInstanceOverrideState,
  recordInstanceOverride,
  type SceneNode
} from '@open-pencil/scene-graph'

import { reconcileVariableLayouts } from '#core/layout/variables'
import { applyLintFixes as applyFixes, type LintFixRequest } from '#core/lint/fixes'

import { createLayoutModeActions } from './layout-mode'
import { createNodePreviewActions } from './node-preview'
import { createNudgeActions } from './nudge'
import { createNumericPropertyGroupActions } from './numeric-property-groups'
import { snapGeometryChanges } from './pixel-snapping'
import { manualTextSizingChanges, textAutoResizeChanges } from './text/auto-resize'
import { pathTextEditChanges } from './text/path-edit'
import type { EditorContext } from './types'
import { createVariableBindingActions } from './variable-bindings'

export function opacityFromBuffer(buffer: string): number {
  if (buffer === '0') return 1
  if (!/^\d+$/.test(buffer)) return 1
  const n = Number.parseInt(buffer, 10)
  if (!Number.isFinite(n)) return 1
  const percent = buffer.length === 1 ? n * 10 : n
  return Math.min(100, Math.max(0, percent)) / 100
}

export function createNodeActions(ctx: EditorContext) {
  const previewActions = createNodePreviewActions(ctx, updateNode)
  const layoutModeActions = createLayoutModeActions(ctx, previewActions.beginNodePreview)
  const nudgeActions = createNudgeActions(ctx)
  const variableBindingActions = createVariableBindingActions(ctx)

  function snapGeometry<T extends Partial<SceneNode>>(changes: T): T {
    return snapGeometryChanges(
      changes,
      ctx.state.snappingPreferences.pixelGrid && !ctx.graph.isApplyingLayout
    )
  }

  function runChangedLayout(id: string, changes: Partial<SceneNode>) {
    // A layer's modes reach the layers inside it.
    if (changes.variableModes) reconcileVariableLayouts(ctx.graph, { subtrees: [id] })
    ctx.runLayoutForNode(id)
  }

  function updateNode(id: string, changes: Partial<SceneNode>) {
    const node = ctx.graph.getNode(id)
    if (!node) return
    changes = { ...changes, ...manualTextSizingChanges(node, changes) }
    // Path-edit last so its reflowed glyphs win over auto-resize's glyph clear
    // (path text is textAutoResize NONE so they don't collide today).
    const nextChanges = styleDetachmentChanges(node, {
      ...changes,
      ...textAutoResizeChanges(node, changes),
      ...pathTextEditChanges(node, changes)
    })
    ctx.graph.updateNode(id, nextChanges)
    recordInstanceOverride(ctx.graph, id, Object.keys(nextChanges))
    runChangedLayout(id, nextChanges)
  }

  function updateNodeWithUndo(id: string, changes: Partial<SceneNode>, label = 'Update') {
    const node = ctx.graph.getNode(id)
    if (!node) return
    changes = { ...changes, ...manualTextSizingChanges(node, changes) }
    // Same ordering rationale as updateNode: reflowed path-text glyphs win.
    const nextChanges = styleDetachmentChanges(node, {
      ...changes,
      ...textAutoResizeChanges(node, changes),
      ...pathTextEditChanges(node, changes)
    })
    const owner = findInstanceAncestor(ctx.graph, id)
    const previousOverrides = owner
      ? cloneInstanceOverrideState(owner.instanceOverrides)
      : undefined
    const previous = pick(
      node,
      Object.keys(nextChanges) as (keyof SceneNode)[]
    ) as Partial<SceneNode>
    ctx.graph.updateNode(id, nextChanges)
    recordInstanceOverride(ctx.graph, id, Object.keys(nextChanges))
    runChangedLayout(id, nextChanges)
    ctx.undo.push({
      label,
      forward: () => {
        ctx.graph.updateNode(id, {
          ...nextChanges,
          ...textAutoResizeChanges(ctx.graph.getNode(id), changes)
        })
        recordInstanceOverride(ctx.graph, id, Object.keys(nextChanges))
        runChangedLayout(id, nextChanges)
      },
      inverse: () => {
        ctx.graph.updateNode(id, previous)
        if (owner && previousOverrides)
          ctx.graph.updateNode(owner.id, {
            instanceOverrides: cloneInstanceOverrideState(previousOverrides)
          })
        runChangedLayout(id, nextChanges)
      }
    })
    ctx.requestRender()
  }

  function setOpacity(opacity: number, coalesceKey?: string) {
    if (!Number.isFinite(opacity)) return
    const clamped = Math.max(0, Math.min(1, opacity))
    const ids = [...ctx.state.selectedIds]
    if (ids.length === 0) return
    const targets = ids.map((id) => ctx.graph.getNode(id)).filter((n): n is SceneNode => n != null)
    const changed = targets.filter((t) => t.opacity !== clamped)
    if (changed.length === 0) return
    ctx.undo.runBatch(
      'Set opacity',
      () => {
        for (const target of changed) {
          updateNodeWithUndo(target.id, { opacity: clamped }, 'Set opacity')
        }
      },
      coalesceKey
    )
  }

  /** Applies lint fixes that still hold as one undo step; returns how many applied. */
  function applyLintFixes(requests: readonly LintFixRequest[]): number {
    return ctx.undo.runBatch('Fix design issues', () =>
      applyFixes(
        {
          graph: ctx.graph,
          updateNode: (id, changes) => updateNodeWithUndo(id, changes, 'Fix design issue'),
          bindVariable: variableBindingActions.bindVariable
        },
        requests
      )
    )
  }

  return {
    snapGeometry,
    updateNode,
    applyLintFixes,
    ...previewActions,
    updateNodeWithUndo,
    setOpacity,
    ...layoutModeActions,
    ...variableBindingActions,
    ...createNumericPropertyGroupActions(ctx),
    ...nudgeActions
  }
}
