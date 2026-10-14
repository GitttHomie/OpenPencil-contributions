import {
  Align,
  Direction,
  Display,
  FlexDirection,
  Gutter,
  Edge,
  MeasureMode,
  Overflow,
  Wrap,
  type Node as YogaNode
} from 'yoga-layout'

import { resolveNodeLayoutDirection } from '@open-pencil/scene-graph/text-direction'

import { applyYogaLayout } from './layout/apply'
import {
  asFlatLeaf,
  asLaidOutIn,
  fillKeepsSizeInHuggingParent,
  hugsCrossAxis,
  heldHugAxis,
  setCrossAxisSizing,
  setMainAxisSizing
} from './layout/axis-sizing'
import { hasEditedLayout, keepsSavedLayout, usesDetachedDerivedLayout } from './layout/derived'
import { applyEffectiveGeneratedTextLayout } from './layout/effective-generated-text'
import { buildGridTree, createGridChildNode } from './layout/grid'
import { hasIndependentCrossAxisChild } from './layout/hug-fill'
import { invalidatePendingLayouts } from './layout/invalidation'
import { sizeAutoResizingText } from './layout/text-auto-resize'
export {
  estimateTextSize,
  getTextMeasurer,
  installTextMeasurer,
  setTextMeasurer,
  type TextMeasurer
} from './layout/text-measurement'
import {
  layoutSizing,
  type LayoutSizing,
  type SceneGraph,
  type SceneNode
} from '@open-pencil/scene-graph'

import { estimateTextSize, getTextMeasurer } from './layout/text-measurement'
import {
  applyMinMaxConstraints,
  applyLockedAspectRatio,
  configureAbsoluteChild,
  configureNonTextLeaf,
  createYogaNode,
  freeYogaTree,
  mapAlign,
  mapAlignSelf,
  mapGridTrack,
  mapJustify
} from './layout/yoga-helpers'

export function computeLayout(graph: SceneGraph, frameId: string): void {
  invalidatePendingLayouts(graph)
  graph.withLayoutMutations(() => computeLayoutInternal(graph, frameId))
}

function computeLayoutInternal(graph: SceneGraph, frameId: string): void {
  const frame = graph.getNode(frameId)
  if (!frame || frame.layoutMode === 'NONE') return

  const rootDirection = resolveComputedLayoutDirection(graph, frame)
  const yogaDirection = rootDirection === 'RTL' ? Direction.RTL : Direction.LTR
  const yogaRoot =
    frame.layoutMode === 'GRID'
      ? buildGridTree(graph, frame, rootDirection)
      : buildYogaTree(graph, frame, rootDirection)
  yogaRoot.calculateLayout(undefined, undefined, yogaDirection)
  applyYogaLayout(graph, frame, yogaRoot, computeLayoutInternal)
  freeYogaTree(yogaRoot)
}
function resolveComputedLayoutDirection(
  graph: SceneGraph,
  node: Pick<SceneNode, 'layoutDirection' | 'parentId'>
): 'LTR' | 'RTL' {
  const parent = node.parentId ? graph.getNode(node.parentId) : null
  const inheritedDirection = parent ? resolveComputedLayoutDirection(graph, parent) : 'LTR'
  return resolveNodeLayoutDirection(node, inheritedDirection)
}

export function computeAllLayouts(graph: SceneGraph, scopeId?: string): void {
  invalidatePendingLayouts(graph)
  graph.withLayoutMutations(() => {
    const rootId = scopeId ?? graph.rootId
    const visited = new Set<string>()
    computeLayoutsBottomUp(graph, rootId, visited)
    if (applyEffectiveGeneratedTextLayout(graph, rootId)) {
      computeLayoutsBottomUp(graph, rootId, new Set())
    }
  })
}

/** Reflows one edited subtree and the layouts containing it, leaving unrelated frames alone. */
export function computeLayoutForNode(graph: SceneGraph, id: string): void {
  const node = graph.getNode(id)
  if (!node) return
  computeAllLayouts(graph, id)
  let parent = node.parentId ? graph.getNode(node.parentId) : undefined
  while (parent) {
    if (parent.layoutMode !== 'NONE') computeLayout(graph, parent.id)
    parent = parent.parentId ? graph.getNode(parent.parentId) : undefined
  }
}

/**
 * Gives content an author wrote, such as design JSX, HTML, or a `.pen` file, the sizes and
 * positions its layout implies, which the source does not store, measuring its text first.
 * Documents that store their geometry, such as `.fig` files, keep theirs and do not come here.
 */
export function layoutAuthoredNodes(graph: SceneGraph, rootIds: Iterable<string>): void {
  const roots = [...rootIds]
  for (const id of roots) {
    sizeAutoResizingText(graph, id)
  }
  const layout = () => {
    for (const id of roots) computeLayoutForNode(graph, id)
  }
  layout()
  // Layout gives wrapping text its width, which its height follows.
  if (roots.map((id) => sizeAutoResizingText(graph, id, true)).some(Boolean)) layout()
}

function computeLayoutsBottomUp(graph: SceneGraph, nodeId: string, visited: Set<string>): void {
  const node = graph.getNode(nodeId)
  if (!node || visited.has(nodeId)) return
  visited.add(nodeId)

  for (const childId of node.childIds) {
    computeLayoutsBottomUp(graph, childId, visited)
  }

  if (node.layoutMode !== 'NONE' && !preservesImportedInstanceLayout(node)) {
    computeLayout(graph, nodeId)
  }
}

function preservesImportedInstanceLayout(node: SceneNode): boolean {
  return node.type === 'INSTANCE' && node.source.format === 'fig' && !hasEditedLayout(node)
}

function buildYogaTree(
  graph: SceneGraph,
  frame: SceneNode,
  inheritedDirection: 'LTR' | 'RTL'
): YogaNode {
  const root = createYogaNode()
  const direction = resolveNodeLayoutDirection(frame, inheritedDirection)

  // A subtree laid out separately still receives its Fill size from its parent.
  // Its own Hug setting must not turn that allocated space into an unbounded axis.
  if (layoutSizing(graph, frame, 'HORIZONTAL') !== 'HUG') root.setWidth(frame.width)
  if (layoutSizing(graph, frame, 'VERTICAL') !== 'HUG') root.setHeight(frame.height)
  const heldAxis = heldHugAxis(graph, frame)
  if (heldAxis === 'width' && layoutSizing(graph, frame, 'HORIZONTAL') === 'HUG')
    root.setWidth(frame.width)
  if (heldAxis === 'height' && layoutSizing(graph, frame, 'VERTICAL') === 'HUG')
    root.setHeight(frame.height)

  configureFlexContainer(root, frame, direction)

  const children = graph.getChildren(frame.id).map((child) => asLaidOutIn(graph, child, frame))
  const independentCrossSize = hasIndependentCrossAxisChild(
    graph,
    frame,
    frame.layoutMode === 'HORIZONTAL' ? 'height' : 'width'
  )
  for (const child of children) {
    const yogaChild = createYogaNode()

    if (child.layoutPositioning === 'ABSOLUTE') {
      configureAbsoluteChild(yogaChild, child)
    } else if (!child.visible) {
      yogaChild.setDisplay(Display.None)
    } else if (child.layoutMode === 'GRID') {
      configureChildAsGrid(yogaChild, child, frame, graph, direction)
    } else if (child.layoutMode !== 'NONE') {
      configureChildAsAutoLayout(yogaChild, child, frame, graph, direction, independentCrossSize)
    } else {
      configureChildAsLeaf(yogaChild, child, frame, graph)
    }

    root.insertChild(yogaChild, root.getChildCount())
  }

  return root
}

function configureFlexContainer(
  yogaNode: YogaNode,
  node: SceneNode,
  direction: Exclude<SceneNode['layoutDirection'], 'AUTO'>
): void {
  yogaNode.setDirection(direction === 'RTL' ? Direction.RTL : Direction.LTR)
  yogaNode.setFlexDirection(
    node.layoutMode === 'HORIZONTAL' ? FlexDirection.Row : FlexDirection.Column
  )
  yogaNode.setFlexWrap(node.layoutWrap === 'WRAP' ? Wrap.Wrap : Wrap.NoWrap)
  yogaNode.setJustifyContent(mapJustify(node.primaryAxisAlign))
  yogaNode.setAlignItems(mapAlign(node.counterAxisAlign))
  if (node.clipsContent) yogaNode.setOverflow(Overflow.Hidden)

  if (node.layoutWrap === 'WRAP' && node.counterAxisAlignContent === 'SPACE_BETWEEN') {
    yogaNode.setAlignContent(Align.SpaceBetween)
  }

  yogaNode.setPadding(Edge.Top, node.paddingTop)
  yogaNode.setPadding(Edge.Right, node.paddingRight)
  yogaNode.setPadding(Edge.Bottom, node.paddingBottom)
  yogaNode.setPadding(Edge.Left, node.paddingLeft)

  const primaryGap = node.primaryAxisAlign === 'SPACE_BETWEEN' ? 0 : node.itemSpacing
  yogaNode.setGap(
    Gutter.Column,
    node.layoutMode === 'HORIZONTAL' ? primaryGap : node.counterAxisSpacing
  )
  yogaNode.setGap(
    Gutter.Row,
    node.layoutMode === 'HORIZONTAL' ? node.counterAxisSpacing : primaryGap
  )

  applyMinMaxConstraints(yogaNode, node)
}

function configureChildAsGrid(
  yogaChild: YogaNode,
  child: SceneNode,
  parent: SceneNode,
  graph: SceneGraph,
  inheritedDirection: 'LTR' | 'RTL'
): void {
  const direction = resolveNodeLayoutDirection(child, inheritedDirection)
  yogaChild.setDisplay(Display.Grid)
  yogaChild.setDirection(direction === 'RTL' ? Direction.RTL : Direction.LTR)

  if (child.gridTemplateColumns.length > 0) {
    yogaChild.setGridTemplateColumns(child.gridTemplateColumns.map(mapGridTrack))
  }
  if (child.gridTemplateRows.length > 0) {
    yogaChild.setGridTemplateRows(child.gridTemplateRows.map(mapGridTrack))
  }

  yogaChild.setGap(Gutter.Column, child.gridColumnGap)
  yogaChild.setGap(Gutter.Row, child.gridRowGap)

  yogaChild.setPadding(Edge.Top, child.paddingTop)
  yogaChild.setPadding(Edge.Right, child.paddingRight)
  yogaChild.setPadding(Edge.Bottom, child.paddingBottom)
  yogaChild.setPadding(Edge.Left, child.paddingLeft)

  const isParentRow = parent.layoutMode === 'HORIZONTAL'
  const selfOverride = child.layoutAlignSelf !== 'AUTO'
  const stretchCross = selfOverride
    ? child.layoutAlignSelf === 'STRETCH'
    : parent.counterAxisAlign === 'STRETCH'

  if (child.layoutGrow > 0) {
    yogaChild.setFlexGrow(child.layoutGrow)
    yogaChild.setFlexShrink(1)
    yogaChild.setFlexBasis(0)
    if (!stretchCross) {
      if (isParentRow) yogaChild.setHeight(child.height)
      else yogaChild.setWidth(child.width)
    }
  } else {
    if (isParentRow) {
      yogaChild.setWidth(child.width)
      if (!stretchCross) yogaChild.setHeight(child.height)
    } else {
      if (child.gridTemplateRows.length > 0) yogaChild.setHeight(child.height)
      if (!stretchCross) yogaChild.setWidth(child.width)
    }
  }

  const selfAlign = mapAlignSelf(child.layoutAlignSelf)
  if (selfAlign != null) yogaChild.setAlignSelf(selfAlign)

  applyLockedAspectRatio(yogaChild, child, parent)
  applyMinMaxConstraints(yogaChild, child)

  const grandchildren = graph.getChildren(child.id)
  for (const gc of grandchildren) {
    if (gc.layoutPositioning === 'ABSOLUTE') {
      const yogaGC = createYogaNode()
      configureAbsoluteChild(yogaGC, gc)
      yogaChild.insertChild(yogaGC, yogaChild.getChildCount())
    } else {
      yogaChild.insertChild(createGridChildNode(graph, gc), yogaChild.getChildCount())
    }
  }
}

function sizesFitParent(
  parent: SceneNode,
  childCount: number,
  sizes: Array<number | undefined>,
  axis: 'width' | 'height'
): boolean {
  if (sizes.some((size) => size === undefined)) return false
  const padding =
    axis === 'width'
      ? parent.paddingLeft + parent.paddingRight
      : parent.paddingTop + parent.paddingBottom
  const gap =
    parent.primaryAxisAlign === 'SPACE_BETWEEN'
      ? 0
      : parent.itemSpacing * Math.max(0, childCount - 1)
  const available = axis === 'width' ? parent.width : parent.height
  const total = sizes.reduce<number>((sum, size) => sum + (size ?? 0), padding + gap)
  return Math.abs(total - available) < 0.001
}

function derivedMainAxisFitsParent(
  graph: SceneGraph,
  parent: SceneNode,
  child: SceneNode,
  axis: 'width' | 'height'
): boolean {
  if (!keepsSavedLayout(graph, parent)) return false
  const children = graph
    .getChildren(parent.id)
    .filter((candidate) => candidate.visible && candidate.layoutPositioning !== 'ABSOLUTE')
  if (children.length === 0) return false

  const sizes = children.map((candidate) => candidate.derivedLayout?.[axis])
  return (
    sizesFitParent(parent, children.length, sizes, axis) &&
    child.derivedLayout?.[axis] !== undefined
  )
}

function usesAuthoritativeGeneratedStretch(parent: SceneNode, child: SceneNode): boolean {
  if (
    hasEditedLayout(parent) ||
    hasEditedLayout(child) ||
    child.layoutAlignSelf !== 'STRETCH' ||
    parent.source.format === 'fig' ||
    !parent.derivedLayout
  ) {
    return false
  }
  const derivedCrossSize =
    parent.layoutMode === 'HORIZONTAL' ? parent.derivedLayout.height : parent.derivedLayout.width
  const parentCrossSize = parent.layoutMode === 'HORIZONTAL' ? parent.height : parent.width
  return derivedCrossSize !== undefined && Math.abs(derivedCrossSize - parentCrossSize) < 0.001
}

function configureAutoLayoutChildSizing(
  yogaChild: YogaNode,
  child: SceneNode,
  parent: SceneNode,
  graph: SceneGraph,
  widthSizing: LayoutSizing,
  heightSizing: LayoutSizing,
  independentCrossSize: boolean
): void {
  const isParentRow = parent.layoutMode === 'HORIZONTAL'
  const fixedDerivedMainAxis = isParentRow
    ? derivedMainAxisFitsParent(graph, parent, child, 'width')
    : derivedMainAxisFitsParent(graph, parent, child, 'height')

  const stretchesAuthoritativeCrossAxis = usesAuthoritativeGeneratedStretch(parent, child)

  if (isParentRow) {
    if (fixedDerivedMainAxis) yogaChild.setWidth(child.derivedLayout?.width ?? child.width)
    else setMainAxisSizing(yogaChild, 'width', widthSizing, child.width, child.layoutGrow)
    const keepsSize =
      !independentCrossSize && fillKeepsSizeInHuggingParent(graph, child, parent, 'height')
    if (!stretchesAuthoritativeCrossAxis)
      setCrossAxisSizing(yogaChild, 'height', heightSizing, child.height, keepsSize)
    return
  }

  const keepsSize =
    !independentCrossSize && fillKeepsSizeInHuggingParent(graph, child, parent, 'width')
  if (!stretchesAuthoritativeCrossAxis)
    setCrossAxisSizing(yogaChild, 'width', widthSizing, child.width, keepsSize)
  if (fixedDerivedMainAxis) yogaChild.setHeight(child.derivedLayout?.height ?? child.height)
  else setMainAxisSizing(yogaChild, 'height', heightSizing, child.height, child.layoutGrow)
}

function configureChildAsAutoLayout(
  yogaChild: YogaNode,
  child: SceneNode,
  parent: SceneNode,
  graph: SceneGraph,
  inheritedDirection: 'LTR' | 'RTL',
  independentCrossSize: boolean
): void {
  const direction = resolveNodeLayoutDirection(child, inheritedDirection)
  const widthSizing = layoutSizing(graph, child, 'HORIZONTAL')
  const heightSizing = layoutSizing(graph, child, 'VERTICAL')

  configureAutoLayoutChildSizing(
    yogaChild,
    child,
    parent,
    graph,
    widthSizing,
    heightSizing,
    independentCrossSize
  )

  const selfAlign = mapAlignSelf(child.layoutAlignSelf)
  if (selfAlign != null) yogaChild.setAlignSelf(selfAlign)
  applyLockedAspectRatio(yogaChild, child, parent)

  if (usesDetachedDerivedLayout(graph, child)) {
    // Saved Hug bounds apply only on axes not allocated by the surrounding layout.
    const derived = child.derivedLayout
    if (widthSizing === 'HUG') yogaChild.setWidth(derived?.width ?? child.width)
    if (heightSizing === 'HUG') {
      yogaChild.setHeight(derived?.height ?? child.height)
    }
    applyMinMaxConstraints(yogaChild, child)
    return
  }

  configureFlexContainer(yogaChild, child, direction)
  const heldAxis = heldHugAxis(graph, child)
  if (heldAxis === 'width' && widthSizing === 'HUG') yogaChild.setWidth(child.width)
  if (heldAxis === 'height' && heightSizing === 'HUG') yogaChild.setHeight(child.height)

  const grandchildren = graph.getChildren(child.id).map((gc) => asLaidOutIn(graph, gc, child))
  const independentChildCrossSize = hasIndependentCrossAxisChild(
    graph,
    child,
    child.layoutMode === 'HORIZONTAL' ? 'height' : 'width'
  )
  for (const gc of grandchildren) {
    const yogaGC = createYogaNode()
    if (gc.layoutPositioning === 'ABSOLUTE') {
      configureAbsoluteChild(yogaGC, gc)
    } else if (!gc.visible) {
      yogaGC.setDisplay(Display.None)
    } else if (gc.layoutMode === 'GRID') {
      configureChildAsGrid(yogaGC, gc, child, graph, direction)
    } else if (gc.layoutMode !== 'NONE') {
      configureChildAsAutoLayout(yogaGC, gc, child, graph, direction, independentChildCrossSize)
    } else {
      configureChildAsLeaf(yogaGC, gc, child, graph)
    }
    yogaChild.insertChild(yogaGC, yogaChild.getChildCount())
  }
}

function derivedGrowingLeafFitsParent(
  graph: SceneGraph,
  parent: SceneNode,
  child: SceneNode,
  axis: 'width' | 'height'
): boolean {
  if (hasEditedLayout(parent) || hasEditedLayout(child)) return false
  if (child.type !== 'TEXT' || child.layoutGrow <= 0 || child.derivedLayout?.[axis] === undefined) {
    return false
  }
  const children = graph
    .getChildren(parent.id)
    .filter((candidate) => candidate.visible && candidate.layoutPositioning !== 'ABSOLUTE')
  const sizes = children.map((candidate) => {
    if (candidate.layoutGrow > 0) return candidate.derivedLayout?.[axis]
    return axis === 'width' ? candidate.width : candidate.height
  })
  return sizesFitParent(parent, children.length, sizes, axis)
}

/**
 * Fill text shares its parent's main axis like a fill frame: it grows and shrinks from a zero
 * basis, so its stored width (100px for new text) never decides its share. Returns whether
 * it fills the row's width, where its stored width must not constrain it either.
 */
function configureGrowingText(
  yogaChild: YogaNode,
  child: SceneNode,
  parent: SceneNode,
  fixedDerivedMainAxis: boolean
): boolean {
  if (child.layoutGrow <= 0 || fixedDerivedMainAxis) return false
  yogaChild.setFlexGrow(child.layoutGrow)
  yogaChild.setFlexShrink(1)
  yogaChild.setFlexBasis(0)
  return parent.layoutMode === 'HORIZONTAL'
}

function configureTextLeafWithoutMeasurer(
  yogaChild: YogaNode,
  child: SceneNode,
  parent: SceneNode,
  fixedDerivedMainAxis: boolean
): void {
  const hasStoredSize =
    child.width > 0 && child.height > 0 && !(child.width === 100 && child.height === 100)

  if (child.textAutoResize === 'WIDTH_AND_HEIGHT') {
    if (hasStoredSize) {
      yogaChild.setWidth(child.width)
      yogaChild.setHeight(child.height)
    } else {
      const estimated = estimateTextSize(child)
      yogaChild.setWidth(estimated.width)
      yogaChild.setHeight(estimated.height)
    }
    return
  }
  if (child.textAutoResize !== 'HEIGHT') return

  const growsWidth = configureGrowingText(yogaChild, child, parent, fixedDerivedMainAxis)
  const isRow = parent.layoutMode === 'HORIZONTAL'
  const measurementWidth = fixedDerivedMainAxis
    ? (child.derivedLayout?.width ?? child.width)
    : child.width
  const stretches =
    child.layoutAlignSelf === 'STRETCH' ||
    (child.layoutAlignSelf === 'AUTO' && parent.counterAxisAlign === 'STRETCH')
  if (!(!isRow && stretches) && !fixedDerivedMainAxis && !growsWidth) {
    yogaChild.setWidth(child.width)
  }
  if (hasStoredSize) yogaChild.setHeight(child.height)
  else yogaChild.setHeight(estimateTextSize(child, measurementWidth).height)
}

function configureChildAsLeaf(
  yogaChild: YogaNode,
  node: SceneNode,
  parent: SceneNode,
  graph: SceneGraph
): void {
  const child = asFlatLeaf(node, parent)
  const isRow = parent.layoutMode === 'HORIZONTAL'
  const selfOverride = child.layoutAlignSelf !== 'AUTO'
  const stretchCross = selfOverride
    ? child.layoutAlignSelf === 'STRETCH'
    : parent.counterAxisAlign === 'STRETCH'

  const isText = child.type === 'TEXT'
  const textMeasurer = getTextMeasurer()
  const needsMeasureFunc = isText && textMeasurer && child.textAutoResize !== 'NONE'

  const fixedDerivedMainAxis = isRow
    ? derivedGrowingLeafFitsParent(graph, parent, child, 'width')
    : derivedGrowingLeafFitsParent(graph, parent, child, 'height')

  if (fixedDerivedMainAxis) {
    if (isRow) yogaChild.setWidth(child.derivedLayout?.width ?? child.width)
    else yogaChild.setHeight(child.derivedLayout?.height ?? child.height)
  }

  if (needsMeasureFunc) {
    configureTextLeaf(yogaChild, child, parent, fixedDerivedMainAxis)
  } else if (isText && !textMeasurer && child.textAutoResize !== 'NONE') {
    configureTextLeafWithoutMeasurer(yogaChild, child, parent, fixedDerivedMainAxis)
  } else {
    configureNonTextLeaf(yogaChild, child, isRow, stretchCross)
    // Fixed text still contributes its box to a HUG cross axis. Without
    // an intrinsic minimum, stretch collapses the text to its siblings.
    if (isText && stretchCross && hugsCrossAxis(graph, parent)) {
      if (isRow) yogaChild.setMinHeight(child.height)
      else yogaChild.setMinWidth(child.width)
    }
  }

  const selfAlign = mapAlignSelf(child.layoutAlignSelf)
  if (selfAlign != null) yogaChild.setAlignSelf(selfAlign)

  applyLockedAspectRatio(yogaChild, child, parent)
  applyMinMaxConstraints(yogaChild, child)
}

function configureTextLeaf(
  yogaChild: YogaNode,
  child: SceneNode,
  parent: SceneNode,
  fixedDerivedMainAxis = false
): void {
  const autoResize = child.textAutoResize
  const isRow = parent.layoutMode === 'HORIZONTAL'
  const growsWidth = configureGrowingText(yogaChild, child, parent, fixedDerivedMainAxis)

  const cache = new Map<number, { width: number; height: number }>()
  const UNCONSTRAINED_KEY = -1

  if (autoResize === 'WIDTH_AND_HEIGHT') {
    const importedSize = child.derivedLayout
    if (importedSize?.width !== undefined && importedSize.height !== undefined) {
      yogaChild.setWidth(child.width)
      yogaChild.setHeight(child.height)
      return
    }

    yogaChild.setMeasureFunc((width, widthMode, _height, _heightMode) => {
      const maxW = widthMode === MeasureMode.Undefined ? undefined : width
      const cacheKey = maxW === undefined ? UNCONSTRAINED_KEY : Math.round(maxW)
      const cached = cache.get(cacheKey)
      if (cached) return cached

      const measured = getTextMeasurer()?.(child, maxW)
      const result = measured ?? estimateTextSize(child, maxW)
      cache.set(cacheKey, result)
      return result
    })
  } else if (autoResize === 'HEIGHT') {
    const stretchesCross =
      child.layoutAlignSelf === 'STRETCH' ||
      (child.layoutAlignSelf === 'AUTO' && parent.counterAxisAlign === 'STRETCH')
    // Let Yoga stretch or grow fill-width text instead of fixing its stored width.
    const fillsWidth = (!isRow && stretchesCross) || growsWidth
    const fixedWidth = fixedDerivedMainAxis
      ? (child.derivedLayout?.width ?? child.width)
      : child.width
    if (child.layoutGrow <= 0 && !fillsWidth) {
      yogaChild.setWidth(fixedWidth)
    }
    yogaChild.setMeasureFunc((width, widthMode, _height, _heightMode) => {
      let constraintW = fixedWidth
      if (fillsWidth) {
        if (widthMode !== MeasureMode.Undefined) constraintW = width
      } else if (widthMode !== MeasureMode.Undefined) {
        constraintW = Math.min(width, fixedWidth || width)
      }
      const cacheKey = Math.round(constraintW)
      const cached = cache.get(cacheKey)
      if (cached) return cached

      if (
        widthMode === MeasureMode.Exactly &&
        constraintW === child.width &&
        (child.derivedTextGlyphs?.length ?? 0) > 0
      ) {
        return { width: constraintW, height: child.height }
      }
      const measured =
        getTextMeasurer()?.(child, constraintW) ?? estimateTextSize(child, constraintW)
      const result = {
        // AtMost is a wrapping limit, not allocated space. Returning it makes every
        // Hug column in a row as wide as the whole row. Yoga applies exact Fill
        // widths after it has measured the columns' intrinsic content.
        width: fillsWidth && widthMode !== MeasureMode.Exactly ? measured.width : constraintW,
        height: measured.height
      }
      cache.set(cacheKey, result)
      return result
    })
  }
}
