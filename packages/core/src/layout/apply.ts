import type { Node as YogaNode } from 'yoga-layout'

import {
  enforcedAspectRatio,
  layoutSizing,
  type SceneGraph,
  type SceneNode
} from '@open-pencil/scene-graph'
import { layoutConstrainedChildRect } from '@open-pencil/scene-graph/resize'

import { hugFrameSizeChanges } from './constraints'
import { hasEditedLayout, keepsSavedLayout, usesDetachedDerivedLayout } from './derived'

export type ComputeLayoutFn = (graph: SceneGraph, frameId: string) => void

function preservesImportedHugCrossSize(
  graph: SceneGraph,
  frame: SceneNode,
  axis: 'width' | 'height'
): boolean {
  if (hasEditedLayout(frame) || frame.source.format !== 'fig' || frame.counterAxisSizing !== 'HUG')
    return false
  const expectedMode = axis === 'width' ? 'VERTICAL' : 'HORIZONTAL'
  if (frame.layoutMode !== expectedMode) return false
  return graph
    .getChildren(frame.id)
    .some(
      (child) => child.layoutAlignSelf === 'STRETCH' && child.derivedLayout?.[axis] !== undefined
    )
}

type LayoutGeometry = Partial<Pick<SceneNode, 'x' | 'y' | 'width' | 'height'>>

/**
 * Writes only the geometry layout changed. Laying out a large page leaves most layers where they
 * were, and each write would notify every graph listener for nothing. A frame it resizes from
 * `before`, by default the size it has, places the layers its constraints govern; `constrained`
 * marks a write those constraints made, which places its own children in turn.
 */
function writeLayoutGeometry(
  graph: SceneGraph,
  id: string,
  geometry: LayoutGeometry,
  computeLayout: ComputeLayoutFn,
  before?: { width: number; height: number },
  constrained = false
): void {
  const node = graph.getNode(id)
  if (!node) return
  const from = before ?? { width: node.width, height: node.height }
  const changes: Partial<SceneNode> = {}
  for (const key of ['x', 'y', 'width', 'height'] as const) {
    const value = geometry[key]
    if (value !== undefined && value !== node[key]) changes[key] = value
  }
  if (Object.keys(changes).length > 0) {
    if (node.vectorNetwork && ('width' in changes || 'height' in changes)) {
      // Layout stretches a path, not its stroke. Scaling a nearly zero-width
      // endpoint's weight can otherwise turn a 1px annotation into a page-sized stroke.
      changes.strokes = node.strokes
      changes.strokeStyleId = node.strokeStyleId
      changes.strokeGeometry = []
    }
    if (node.source.editedFields.includes('derivedLayout') && !graph.isPreservingSourceMetadata) {
      changes.source = {
        ...node.source,
        editedFields: [...new Set([...node.source.editedFields, ...Object.keys(changes)])]
      }
    }
    graph.updateNode(id, changes)
  }
  if (!CONSTRAINT_PARENT_TYPES.has(node.type)) return
  // Laying out what a file holds, as a page opens or its fonts arrive, resizes a frame only where
  // our layout differs from the one the file saved; its children keep the places it saved.
  if (graph.isApplyingDerivedLayout && !constrained) return
  if (from.width !== node.width || from.height !== node.height) {
    constrainChildren(graph, node, from, computeLayout)
  }
}

/**
 * The size each Hug frame had after layout last ran on it. Keyed by the node, so a deleted
 * frame's entry goes with it and a restored one starts afresh.
 */
const huggedSizes = new WeakMap<SceneNode, { width: number; height: number }>()

/** An authored or synchronized size establishes a new coordinate space for its children. */
export function resetHugConstraintSize(node: SceneNode): void {
  huggedSizes.delete(node)
}

const CONSTRAINT_PARENT_TYPES: ReadonlySet<SceneNode['type']> = new Set([
  'FRAME',
  'COMPONENT',
  'COMPONENT_SET',
  'INSTANCE'
])

/**
 * Places the children of a frame layout resized by their constraints: every child of a frame
 * without auto layout, and those that ignore an auto layout, as Figma keeps a badge pinned to the
 * right of a Hug button while its label grows. A child it resizes places its own children, and
 * lays out again when it has auto layout.
 */
function constrainChildren(
  graph: SceneGraph,
  frame: SceneNode,
  before: { width: number; height: number },
  computeLayout: ComputeLayoutFn
): void {
  for (const child of graph.getChildren(frame.id)) {
    if (frame.layoutMode !== 'NONE' && child.layoutPositioning !== 'ABSOLUTE') continue
    const size = { width: child.width, height: child.height }
    writeLayoutGeometry(
      graph,
      child.id,
      layoutConstrainedChildRect(
        child,
        before,
        frame,
        child.horizontalConstraint,
        child.verticalConstraint,
        enforcedAspectRatio(child)
      ),
      computeLayout,
      undefined,
      true
    )
    const resized = child.width !== size.width || child.height !== size.height
    if (resized && child.layoutMode !== 'NONE') computeLayout(graph, child.id)
  }
}

/**
 * The size a frame's constrained children move from as it hugs, or null when it hugs no axis.
 * An editor that resizes a Hug frame places its children for the size it sets, which layout then
 * hugs back, as when a parent stretches it; its children move only from the size it last hugged
 * to. An axis it does not hug keeps the size it has.
 */
function hugStart(frame: SceneNode): { width: number; height: number } | null {
  const row = frame.layoutMode === 'HORIZONTAL'
  const hugsWidth = (row ? frame.primaryAxisSizing : frame.counterAxisSizing) === 'HUG'
  const hugsHeight = (row ? frame.counterAxisSizing : frame.primaryAxisSizing) === 'HUG'
  if (!hugsWidth && !hugsHeight) {
    huggedSizes.delete(frame)
    return null
  }
  const hugged = huggedSizes.get(frame)
  return {
    width: hugsWidth && hugged ? hugged.width : frame.width,
    height: hugsHeight && hugged ? hugged.height : frame.height
  }
}

function applyFrameSize(
  graph: SceneGraph,
  frame: SceneNode,
  yogaNode: YogaNode,
  keepsSaved: boolean,
  computeLayout: ComputeLayoutFn
): void {
  if (frame.layoutMode === 'GRID') {
    if (frame.gridTemplateRows.length === 0) {
      writeLayoutGeometry(graph, frame.id, { height: yogaNode.getComputedHeight() }, computeLayout)
    }
    return
  }

  const before = hugStart(frame)
  if (!before) return

  const updates: LayoutGeometry = {}
  const derived = keepsSaved ? frame.derivedLayout : null
  const primary = frame.layoutMode === 'HORIZONTAL' ? 'width' : 'height'
  const counter = primary === 'width' ? 'height' : 'width'
  const computed = (axis: 'width' | 'height') =>
    axis === 'width' ? yogaNode.getComputedWidth() : yogaNode.getComputedHeight()
  if (frame.primaryAxisSizing === 'HUG')
    updates[primary] =
      layoutSizing(graph, frame, primary === 'width' ? 'HORIZONTAL' : 'VERTICAL') === 'FILL'
        ? computed(primary)
        : (derived?.[primary] ?? computed(primary))
  if (frame.counterAxisSizing === 'HUG') {
    const fillsCounter =
      layoutSizing(graph, frame, counter === 'width' ? 'HORIZONTAL' : 'VERTICAL') === 'FILL'
    if (fillsCounter) updates[counter] = computed(counter)
    else if (keepsSaved && preservesImportedHugCrossSize(graph, frame, counter))
      updates[counter] = frame[counter]
    else updates[counter] = derived?.[counter] ?? computed(counter)
  }

  writeLayoutGeometry(
    graph,
    frame.id,
    hugFrameSizeChanges(graph, frame, updates),
    computeLayout,
    before
  )
  huggedSizes.set(frame, { width: frame.width, height: frame.height })
}

function computedChildPosition(
  child: SceneNode,
  yogaChild: YogaNode,
  axis: 'x' | 'y',
  preservesImportedGeometry: boolean,
  keepsSaved: boolean
): number {
  if (preservesImportedGeometry) return child[axis]
  const computed = axis === 'x' ? yogaChild.getComputedLeft() : yogaChild.getComputedTop()
  if (child.type === 'INSTANCE' || !keepsSaved) return computed
  return child.derivedLayout?.[axis] ?? computed
}

function preservesStaleImportedTextSize(child: SceneNode, axis: 'width' | 'height'): boolean {
  const derivedSize = child.derivedLayout?.[axis]
  return (
    child.type === 'TEXT' &&
    child.source.format === 'fig' &&
    derivedSize !== undefined &&
    Math.abs(child[axis] - derivedSize) > 0.001
  )
}

function computedChildSize(
  child: SceneNode,
  yogaChild: YogaNode,
  axis: 'width' | 'height',
  preservesImportedFrameGeometry: boolean,
  keepsSaved: boolean
): number {
  if (
    preservesImportedFrameGeometry ||
    (keepsSaved && preservesStaleImportedTextSize(child, axis))
  ) {
    return child[axis]
  }
  const computed = axis === 'width' ? yogaChild.getComputedWidth() : yogaChild.getComputedHeight()
  if (child.type === 'TEXT' && child.source.format === 'fig') {
    return computed > 0 ? computed : child[axis]
  }
  if (!keepsSaved) return computed
  return child.derivedLayout?.[axis] ?? computed
}

function updateChildFromYoga(
  graph: SceneGraph,
  frame: SceneNode,
  child: SceneNode,
  yogaChild: YogaNode,
  keepsSaved: boolean,
  computeLayout: ComputeLayoutFn
): void {
  if (!child.visible || child.layoutPositioning === 'ABSOLUTE') return

  const savedFig = keepsSaved && child.source.format === 'fig'
  const preservesImportedFrameGeometry =
    savedFig && frame.source.format === 'fig' && (child.type === 'FRAME' || child.type === 'LINE')
  const preservesImportedPosition =
    preservesImportedFrameGeometry || (savedFig && Math.abs(child.rotation) > 0.001)
  writeLayoutGeometry(
    graph,
    child.id,
    {
      x: computedChildPosition(child, yogaChild, 'x', preservesImportedPosition, keepsSaved),
      y: computedChildPosition(child, yogaChild, 'y', preservesImportedPosition, keepsSaved),
      width: computedChildSize(
        child,
        yogaChild,
        'width',
        preservesImportedFrameGeometry,
        keepsSaved &&
          (layoutSizing(graph, child, 'HORIZONTAL') !== 'FILL' ||
            frame.derivedLayout?.width === frame.width)
      ),
      height: computedChildSize(
        child,
        yogaChild,
        'height',
        preservesImportedFrameGeometry,
        keepsSaved &&
          (layoutSizing(graph, child, 'VERTICAL') !== 'FILL' ||
            frame.derivedLayout?.height === frame.height)
      )
    },
    computeLayout
  )
}

function preservesImportedInstanceInternals(child: SceneNode): boolean {
  return child.type === 'INSTANCE' && child.source.format === 'fig' && !hasEditedLayout(child)
}

function recomputeGridChild(
  graph: SceneGraph,
  child: SceneNode,
  computeLayout: ComputeLayoutFn
): void {
  const updated = graph.getNode(child.id)
  if (!updated || updated.layoutMode === 'NONE') return

  const savedPrimary = updated.primaryAxisSizing
  const savedCounter = updated.counterAxisSizing
  const updates: Partial<SceneNode> = {}

  if (savedPrimary === 'HUG') updates.primaryAxisSizing = 'FIXED'
  if (savedCounter === 'HUG') updates.counterAxisSizing = 'FIXED'
  if (Object.keys(updates).length > 0) graph.updateNode(child.id, updates)

  computeLayout(graph, child.id)

  const restore: Partial<SceneNode> = {}
  if (updates.primaryAxisSizing) restore.primaryAxisSizing = savedPrimary
  if (updates.counterAxisSizing) restore.counterAxisSizing = savedCounter
  if (Object.keys(restore).length > 0) graph.updateNode(child.id, restore)
}

export function applyYogaLayout(
  graph: SceneGraph,
  frame: SceneNode,
  yogaNode: YogaNode,
  computeLayout: ComputeLayoutFn
): void {
  const keepsSaved = keepsSavedLayout(graph, frame)
  applyFrameSize(graph, frame, yogaNode, keepsSaved, computeLayout)

  const children = graph.getChildren(frame.id)
  let yogaIndex = 0
  for (const child of children) {
    if (yogaIndex >= yogaNode.getChildCount()) continue
    const yogaChild = yogaNode.getChild(yogaIndex)
    yogaIndex++

    updateChildFromYoga(graph, frame, child, yogaChild, keepsSaved, computeLayout)

    if (!child.visible) continue
    if (preservesImportedInstanceInternals(child)) continue

    if (usesDetachedDerivedLayout(graph, child)) {
      computeLayout(graph, child.id)
      continue
    }

    if (child.layoutMode !== 'NONE') {
      if (child.layoutPositioning === 'ABSOLUTE' || child.layoutMode === 'GRID') {
        computeLayout(graph, child.id)
      } else if (frame.layoutMode === 'GRID') {
        recomputeGridChild(graph, child, computeLayout)
      } else {
        applyYogaLayout(graph, child, yogaChild, computeLayout)
      }
    }
  }
}
