import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

/** Explicit sizing/layout edits supersede geometry materialized when a file was read. */
export function hasEditedLayout(node: SceneNode): boolean {
  // Import normalization also marks text and geometry fields as edited. Live changes
  // to those fields are distinguished by the recorder's derivedLayout provenance.
  return node.source.editedFields.some((key) =>
    [
      'layoutMode',
      'primaryAxisSizing',
      'counterAxisSizing',
      'layoutGrow',
      'layoutAlignSelf',
      'derivedLayout'
    ].includes(key)
  )
}

/** A content edit invalidates saved geometry throughout the connected layout tree. */
export function invalidateDerivedLayout(graph: SceneGraph, nodeId: string): void {
  invalidateDerivedLayouts(graph, [nodeId])
}

/** Batch connected trees so several edits in the same layout invalidate it only once. */
export function invalidateDerivedLayouts(
  graph: SceneGraph,
  nodeIds: Iterable<string>,
  preservedRoots?: ReadonlySet<string>
): Set<string> {
  const roots = new Set<SceneNode>()
  for (const nodeId of nodeIds) {
    const root = graph.closest(nodeId, (node) => {
      const parent = node.parentId ? graph.getNode(node.parentId) : undefined
      return node.layoutPositioning === 'ABSOLUTE' || !parent || parent.layoutMode === 'NONE'
    })
    if (root && !preservedRoots?.has(root.id)) roots.add(root)
  }
  const changedRoots = new Set<string>()
  const visited = new Set<string>()
  function invalidate(node: SceneNode, rootId: string) {
    if (visited.has(node.id)) return
    visited.add(node.id)
    if (
      node.derivedLayout ||
      (node.source.format === 'fig' && !node.source.editedFields.includes('derivedLayout'))
    ) {
      graph.updateNode(node.id, {
        derivedLayout: null,
        source: {
          ...node.source,
          editedFields: [...new Set([...node.source.editedFields, 'derivedLayout'])]
        }
      })
      changedRoots.add(rootId)
    }
    if (node.layoutMode === 'NONE') return
    for (const child of graph.getChildren(node.id)) {
      if (child.layoutPositioning !== 'ABSOLUTE') invalidate(child, rootId)
    }
  }
  for (const root of roots) invalidate(root, root.id)
  return changedRoots
}

/** The layers in each .fig frame's flow when layout first saw them, as its page opened. */
const savedFlows = new WeakMap<SceneGraph, Map<string, string>>()
/** Frames whose flow, or a flow inside it, lost or gained a layer since; kept until reload. */
const restructured = new WeakMap<SceneGraph, Set<string>>()
/** Frames that last laid out without their saved geometry, for the frames around them. */
const reflowed = new WeakMap<SceneGraph, Set<string>>()

function graphState<T>(states: WeakMap<SceneGraph, T>, graph: SceneGraph, create: () => T): T {
  let state = states.get(graph)
  if (!state) {
    state = create()
    states.set(graph, state)
  }
  return state
}

function flowOf(graph: SceneGraph, node: SceneNode): SceneNode[] {
  return graph.getChildren(node.id).filter((child) => child.layoutPositioning !== 'ABSOLUTE')
}

/**
 * Loading a file adds, moves, and removes layers too, so structure edits are told from it by
 * comparing the layers in a frame's flow, in order, with those layout first saw. A layer that
 * ignores auto layout, or stops ignoring it, leaves or joins the flow.
 */
function flowChanged(graph: SceneGraph, node: SceneNode, flow = flowOf(graph, node)): boolean {
  const seen = graphState(savedFlows, graph, () => new Map<string, string>())
  const ids = flow.map((child) => child.id).join(',')
  const saved = seen.get(node.id)
  if (saved === undefined) seen.set(node.id, ids)
  return saved !== undefined && saved !== ids
}

/**
 * Records that a layer joined, left, or moved in `parentId`'s children, as an editor sees an edit
 * happen, so the frame stops keeping saved geometry even if layout never ran on it before.
 */
export function markFlowChanged(graph: SceneGraph, parentId: string): void {
  graphState(restructured, graph, () => new Set<string>()).add(parentId)
}

/**
 * Whether layout still keeps the geometry saved for `frame` and its flow. A frame stops once a
 * layer joins, leaves, or moves in its flow or a flow inside it, or once it or a layer in its flow
 * has its layout edited, such as by adding auto layout or a gap or restyling text. That holds for
 * layers read without a source format too, as a .fig file's components and instances are.
 */
export function keepsSavedLayout(graph: SceneGraph, frame: SceneNode): boolean {
  const fromFig = frame.source.format === 'fig'
  const flow = flowOf(graph, frame)
  // Nothing saved to keep: the usual case outside documents read from files.
  if (!fromFig && !frame.derivedLayout && !flow.some((child) => child.derivedLayout)) return true
  const stale = graphState(restructured, graph, () => new Set<string>())
  if (stale.has(frame.id)) return false
  // Layout runs inner frames first, so a changed flow deep inside is already marked.
  if (
    flowChanged(graph, frame, flow) ||
    flow.some((child) => stale.has(child.id) || flowChanged(graph, child))
  ) {
    stale.add(frame.id)
    return false
  }
  // A flow inside edited by now resizes this one, but a cancelled preview gives it back.
  const last = graphState(reflowed, graph, () => new Set<string>())
  const keeps =
    !hasEditedLayout(frame) && !flow.some((child) => hasEditedLayout(child) || last.has(child.id))
  if (keeps) last.delete(frame.id)
  else last.add(frame.id)
  return keeps
}

export function usesDetachedDerivedLayout(graph: SceneGraph, child: SceneNode): boolean {
  const derived = child.derivedLayout
  if (!derived || hasEditedLayout(child) || child.layoutMode === 'NONE' || child.layoutGrow > 0)
    return false
  const isRow = child.layoutMode === 'HORIZONTAL'
  const widthSizing = isRow ? child.primaryAxisSizing : child.counterAxisSizing
  const heightSizing = isRow ? child.counterAxisSizing : child.primaryAxisSizing
  return (
    ((widthSizing === 'HUG' && derived.width !== undefined) ||
      (heightSizing === 'HUG' && derived.height !== undefined)) &&
    keepsSavedLayout(graph, child)
  )
}
