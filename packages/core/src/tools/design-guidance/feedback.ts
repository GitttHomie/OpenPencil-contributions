import { isInComponent, type SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

export interface DesignFeedback {
  code:
    | 'unbound-spacing'
    | 'component-name-collision'
    | 'canvas-overlap'
    | 'component-overlap'
    | 'component-overflow'
  nodeIds: string[]
  message: string
}

const SPACING_FIELDS = [
  'itemSpacing',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft'
] as const
const MAX_FINDINGS = 3
const MAX_NODE_IDS = 4
const MAX_DEFINITION_COMPARISONS = 10_000
const BOUNDS_TOLERANCE = 0.01

/** Inspect authored nodes, leaving instance internals to their main components. */
function authoredNodes(graph: SceneGraph, rootIds: string[]): SceneNode[] {
  const nodes: SceneNode[] = []
  const pending = [...rootIds]
  const seen = new Set<string>()
  while (pending.length > 0) {
    const id = pending.pop()
    if (!id || seen.has(id)) continue
    seen.add(id)
    const node = graph.getNode(id)
    if (!node || !node.visible || node.type === 'INSTANCE') continue
    nodes.push(node)
    pending.push(...node.childIds)
  }
  return nodes
}

function spacingFeedback(nodes: SceneNode[]): DesignFeedback[] {
  const values = new Map<number, Set<string>>()
  for (const node of nodes) {
    if (node.layoutMode === 'NONE') continue
    for (const field of SPACING_FIELDS) {
      if (field === 'itemSpacing' && node.childIds.length < 2) continue
      const value = node[field]
      if (value <= 0 || node.boundVariables[field]) continue
      const ids = values.get(value) ?? new Set<string>()
      ids.add(node.id)
      values.set(value, ids)
    }
  }
  return [...values]
    .filter(([, ids]) => ids.size >= 2)
    .sort((left, right) => right[1].size - left[1].size)
    .slice(0, MAX_FINDINGS)
    .map(([value, ids]) => ({
      code: 'unbound-spacing',
      nodeIds: [...ids].slice(0, MAX_NODE_IDS),
      message: `${value}px spacing is repeated across ${ids.size} authored containers without variable bindings. For shared spacing roles, reuse or create a FLOAT variable and bind the gap/padding; keep intentional one-off values.`
    }))
}

function componentFeedback(graph: SceneGraph, nodes: SceneNode[]): DesignFeedback[] {
  const findings: DesignFeedback[] = []
  const checked = new Set<string>()
  const components = nodes.filter(
    (node) => node.type === 'COMPONENT' || node.type === 'COMPONENT_SET'
  )
  if (components.length === 0) return findings
  const definitions = new Map<string, SceneNode[]>()
  for (const node of graph.getAllNodes()) {
    if (node.type !== 'COMPONENT' && node.type !== 'COMPONENT_SET') continue
    if (graph.getNode(node.parentId ?? '')?.type === 'COMPONENT_SET') continue
    const key = `${node.type}:${node.name.trim()}`
    const group = definitions.get(key) ?? []
    group.push(node)
    definitions.set(key, group)
  }
  for (const node of components) {
    // Variant names are local to their set and can legitimately repeat across sets.
    if (graph.getNode(node.parentId ?? '')?.type === 'COMPONENT_SET') continue
    const name = node.name.trim()
    const key = `${node.type}:${name}`
    if (!name || checked.has(key)) continue
    checked.add(key)
    const matches = (definitions.get(key) ?? []).filter((other) => other.id !== node.id)
    if (matches.length === 0) continue
    findings.push({
      code: 'component-name-collision',
      nodeIds: [node.id, ...matches.map((other) => other.id)].slice(0, MAX_NODE_IDS),
      message: `Another ${node.type === 'COMPONENT' ? 'main component' : 'component set'} is named "${name}". Inspect these IDs and reuse the intended definition; do not recreate it on retry or delete a distinct design merely because its name matches.`
    })
    if (findings.length === MAX_FINDINGS) break
  }
  return findings
}

function unrotatedOverlap(node: SceneNode, other: SceneNode): boolean {
  return (
    node.width > 0 &&
    node.height > 0 &&
    other.width > 0 &&
    other.height > 0 &&
    node.x < other.x + other.width &&
    node.x + node.width > other.x &&
    node.y < other.y + other.height &&
    node.y + node.height > other.y
  )
}

function isDefinitionContainer(graph: SceneGraph, node: SceneNode): boolean {
  return (
    node.type === 'COMPONENT_SET' ||
    ((node.type === 'FRAME' || node.type === 'SECTION') && !isInComponent(graph, node.id))
  )
}

function collectDefinitionContainers(graph: SceneGraph, nodes: SceneNode[]): Set<string> {
  const definitionContainers = new Set<string>()
  // Include layout rows around definitions, so overflow through an intermediate wrapper
  // cannot hide the same problem. Stop at component content and the authored root.
  const authoredIds = new Set(nodes.map((node) => node.id))
  for (const node of nodes.toReversed()) {
    if (
      node.type !== 'COMPONENT' &&
      node.type !== 'COMPONENT_SET' &&
      !definitionContainers.has(node.id)
    )
      continue
    const parent = graph.getNode(node.parentId ?? '')
    if (parent && authoredIds.has(parent.id) && isDefinitionContainer(graph, parent))
      definitionContainers.add(parent.id)
  }
  return definitionContainers
}

/** Check definition containers, not intentional overlays inside a component or instance. */
function definitionLayoutFeedback(graph: SceneGraph, nodes: SceneNode[]): DesignFeedback[] {
  const findings: DesignFeedback[] = []
  let comparisons = 0
  const definitionContainers = collectDefinitionContainers(graph, nodes)
  for (const parent of nodes) {
    if (!isDefinitionContainer(graph, parent)) continue
    const definitions = graph
      .getChildren(parent.id)
      .filter(
        (node) =>
          node.visible &&
          node.rotation === 0 &&
          node.width > 0 &&
          node.height > 0 &&
          (node.type === 'COMPONENT' ||
            node.type === 'COMPONENT_SET' ||
            definitionContainers.has(node.id))
      )
      .sort((left, right) => left.x - right.x)
    for (const [index, node] of definitions.entries()) {
      if (
        node.x < -BOUNDS_TOLERANCE ||
        node.y < -BOUNDS_TOLERANCE ||
        node.x + node.width > parent.width + BOUNDS_TOLERANCE ||
        node.y + node.height > parent.height + BOUNDS_TOLERANCE
      ) {
        findings.push({
          code: 'component-overflow',
          nodeIds: [node.id, parent.id],
          message: `${definitionContainers.has(node.id) ? 'Definition container' : 'Definition'} "${node.name}" extends outside "${parent.name}". Inspect the container's bounds and sizing; use Hug or resize the container to enclose its definitions unless this overflow is intentional.`
        })
        if (findings.length === MAX_FINDINGS) return findings
      }
      for (let next = index + 1; next < definitions.length; next++) {
        const other = definitions[next]
        if (other.x >= node.x + node.width) break
        if (++comparisons > MAX_DEFINITION_COMPARISONS) return findings
        if (!unrotatedOverlap(node, other)) continue
        findings.push({
          code: 'component-overlap',
          nodeIds: [node.id, other.id, parent.id],
          message: `Definitions "${node.name}" and "${other.name}" overlap inside "${parent.name}". Inspect their bounds and arrange these existing definitions with auto-layout or explicit positions; do not recreate or detach their instances.`
        })
        if (findings.length === MAX_FINDINGS) return findings
      }
    }
  }
  return findings
}

function placementFeedback(graph: SceneGraph, rootIds: string[]): DesignFeedback[] {
  const findings: DesignFeedback[] = []
  const pairs = new Set<string>()
  for (const id of rootIds) {
    const node = graph.getNode(id)
    const parent = node?.parentId ? graph.getNode(node.parentId) : undefined
    if (!node || parent?.type !== 'CANVAS' || !node.visible || node.rotation !== 0) continue
    for (const other of graph.getChildren(parent.id)) {
      if (other.id === id || !other.visible || other.rotation !== 0) continue
      if (!unrotatedOverlap(node, other)) continue
      const pair = [node.id, other.id].sort().join('/')
      if (pairs.has(pair)) continue
      pairs.add(pair)
      findings.push({
        code: 'canvas-overlap',
        nodeIds: [node.id, other.id],
        message: `"${node.name}" overlaps top-level "${other.name}". If these are separate screens or component boards, move only the newly created work to free space; preserve intentional overlays and existing user content.`
      })
      if (findings.length === MAX_FINDINGS) return findings
    }
  }
  return findings
}

/** Bounded evidence for the next agent step; these are suggestions, never automatic edits. */
export function designFeedback(graph: SceneGraph, rootIds: string[]): DesignFeedback[] {
  const nodes = authoredNodes(graph, rootIds)
  return [
    ...spacingFeedback(nodes),
    ...componentFeedback(graph, nodes),
    ...definitionLayoutFeedback(graph, nodes),
    ...placementFeedback(graph, rootIds)
  ]
}
