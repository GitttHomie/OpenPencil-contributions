import type { LayoutMode, LayoutSizing, SceneNode } from '@open-pencil/scene-graph'

import type { NodePreview } from './node-preview'
import type { EditorContext } from './types'

export function createLayoutModeActions(
  ctx: EditorContext,
  beginNodePreview: (label: string) => NodePreview
) {
  function setLayoutMode(id: string, mode: LayoutMode) {
    const node = ctx.graph.getNode(id)
    if (!node || node.layoutMode === mode) return

    const updates = layoutModeUpdates(ctx, node, id, mode)
    // Layout can resize descendants, Hug ancestors, and siblings. Record the entire
    // property transaction and replay it exactly instead of recalculating on undo.
    const preview = beginNodePreview(mode === 'NONE' ? 'Remove auto layout' : 'Add auto layout')
    preview.update(id, editedLayoutChanges(node, updates))
    preview.commit()
  }

  function setLayoutPositioning(ids: string[], positioning: SceneNode['layoutPositioning']) {
    const nodes = [...new Set(ids)].map((id) => ctx.graph.getNode(id))
    if (
      nodes.length === 0 ||
      nodes.some((node) => {
        const parent = node?.parentId ? ctx.graph.getNode(node.parentId) : undefined
        return !parent || parent.layoutMode === 'NONE'
      })
    )
      return

    // Capture every target before layout can move or resize a later sibling.
    const changes = nodes.flatMap((node) => {
      if (!node || node.layoutPositioning === positioning) return []
      const patch: Partial<SceneNode> = { layoutPositioning: positioning }
      if (positioning === 'ABSOLUTE') {
        Object.assign(patch, {
          x: node.x,
          y: node.y,
          width: node.width,
          height: node.height,
          layoutGrow: 0,
          layoutAlignSelf: 'AUTO',
          primaryAxisSizing: node.primaryAxisSizing === 'FILL' ? 'FIXED' : node.primaryAxisSizing,
          counterAxisSizing: node.counterAxisSizing === 'FILL' ? 'FIXED' : node.counterAxisSizing
        })
      }
      return [{ id: node.id, patch }]
    })
    if (!changes.length) return
    const preview = beginNodePreview(
      positioning === 'ABSOLUTE' ? 'Exclude from auto layout' : 'Include in auto layout'
    )
    for (const { id, patch } of changes) preview.update(id, patch)
    // Exclusion itself keeps the captured position, even when removing flow
    // children shrinks a Hug parent. Subsequent resizes follow the saved constraints.
    if (positioning === 'ABSOLUTE') {
      for (const { id, patch } of changes) preview.update(id, { x: patch.x, y: patch.y })
    }
    preview.commit()
  }

  function setLayoutSizing(id: string, axis: 'width' | 'height', sizing: LayoutSizing) {
    const node = ctx.graph.getNode(id)
    if (!node) return
    const parent = node.parentId ? ctx.graph.getNode(node.parentId) : undefined
    const parentMode =
      node.layoutPositioning === 'ABSOLUTE' ? 'NONE' : (parent?.layoutMode ?? 'NONE')
    if (sizing === 'FILL' && parentMode === 'NONE') return

    const preview = beginNodePreview(`Set ${axis} sizing`)
    // Fill needs a definite parent extent. Freeze only the affected Hug axis,
    // before touching the child, so layout cannot resolve the cycle to zero.
    if (sizing === 'FILL' && parent && parentMode !== 'GRID') {
      const key = sizingKey(parent, axis)
      if (parent[key] === 'HUG') {
        preview.update(
          parent.id,
          editedLayoutChanges(parent, { [key]: 'FIXED', [axis]: parent[axis] })
        )
      }
    }
    // Conversely, Hug must measure children rather than depend on their Fill.
    if (sizing === 'HUG' && node.layoutMode !== 'NONE') {
      for (const child of ctx.graph.getChildren(id)) {
        if (child.layoutPositioning === 'ABSOLUTE') continue
        if (fillsLayoutAxis(child, axis, node.layoutMode)) {
          preview.update(
            child.id,
            editedLayoutChanges(child, layoutSizingPatch(child, axis, 'FIXED', node.layoutMode))
          )
        }
      }
    }
    preview.update(id, editedLayoutChanges(node, layoutSizingPatch(node, axis, sizing, parentMode)))
    preview.commit()
  }

  return { setLayoutMode, setLayoutPositioning, setLayoutSizing }
}

function editedLayoutChanges(node: SceneNode, changes: Partial<SceneNode>): Partial<SceneNode> {
  return {
    ...changes,
    derivedLayout: null,
    source: {
      ...node.source,
      editedFields: [...new Set([...node.source.editedFields, ...Object.keys(changes)])]
    }
  }
}

function sizingKey(node: SceneNode, axis: 'width' | 'height') {
  const primary = axis === (node.layoutMode === 'HORIZONTAL' ? 'width' : 'height')
  return primary ? 'primaryAxisSizing' : 'counterAxisSizing'
}

function fillsLayoutAxis(node: SceneNode, axis: 'width' | 'height', parentMode: LayoutMode) {
  const flex = node.layoutMode === 'HORIZONTAL' || node.layoutMode === 'VERTICAL'
  if (flex && node[sizingKey(node, axis)] === 'FILL') return true
  const main = axis === (parentMode === 'VERTICAL' ? 'height' : 'width')
  return main ? node.layoutGrow > 0 : node.layoutAlignSelf === 'STRETCH'
}

/** Physical-axis sizing; grow and stretch follow the parent's direction. */
export function layoutSizingPatch(
  node: SceneNode,
  axis: 'width' | 'height',
  sizing: LayoutSizing,
  parentMode: LayoutMode
): Partial<SceneNode> {
  const patch: Partial<SceneNode> = {}
  const flex = node.layoutMode === 'HORIZONTAL' || node.layoutMode === 'VERTICAL'
  if (flex) patch[sizingKey(node, axis)] = sizing
  else {
    const key = axis === 'width' ? 'counterAxisSizing' : 'primaryAxisSizing'
    if (sizing === 'HUG' && node.childIds.length > 0) patch[key] = 'HUG'
    else if (node[key] === 'HUG') patch[key] = 'FIXED'
  }
  if (parentMode !== 'NONE') {
    const main = axis === (parentMode === 'VERTICAL' ? 'height' : 'width')
    if (main) patch.layoutGrow = sizing === 'FILL' ? 1 : 0
    else patch.layoutAlignSelf = sizing === 'FILL' ? 'STRETCH' : 'AUTO'
  }
  return patch
}

function layoutModeUpdates(
  ctx: EditorContext,
  node: SceneNode,
  id: string,
  mode: LayoutMode
): Partial<SceneNode> {
  const updates: Partial<SceneNode> = { layoutMode: mode }
  if (mode === 'GRID' && node.layoutMode !== 'GRID') {
    applyGridDefaults(ctx, node, id, updates)
  } else if (mode !== 'NONE' && node.layoutMode === 'NONE') {
    Object.assign(updates, autoLayoutDefaults())
  }
  return updates
}

function applyGridDefaults(
  ctx: EditorContext,
  node: SceneNode,
  id: string,
  updates: Partial<SceneNode>
) {
  const children = ctx.graph.getChildren(id)
  const cols = Math.max(2, Math.ceil(Math.sqrt(children.length)))
  const rows = Math.max(1, Math.ceil(children.length / cols))
  updates.gridTemplateColumns = Array.from({ length: cols }, () => ({
    sizing: 'FR' as const,
    value: 1
  }))
  updates.gridTemplateRows = Array.from({ length: rows }, () => ({
    sizing: 'FR' as const,
    value: 1
  }))
  updates.gridColumnGap = 0
  updates.gridRowGap = 0
  updates.primaryAxisSizing = 'FIXED'
  updates.counterAxisSizing = 'FIXED'
  if (node.primaryAxisSizing === 'HUG' || node.counterAxisSizing === 'HUG') {
    const maxChildW = Math.max(...children.map((child) => child.width), 100)
    const maxChildH = Math.max(...children.map((child) => child.height), 100)
    updates.width = maxChildW * cols
    updates.height = maxChildH * rows
  }
  updates.paddingTop = 0
  updates.paddingRight = 0
  updates.paddingBottom = 0
  updates.paddingLeft = 0
}

function autoLayoutDefaults(): Partial<SceneNode> {
  return {
    itemSpacing: 0,
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'HUG',
    primaryAxisAlign: 'MIN',
    counterAxisAlign: 'MIN'
  }
}
