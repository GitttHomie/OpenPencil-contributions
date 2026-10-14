import { isEqual } from 'es-toolkit'
import { omit, pick } from 'es-toolkit/object'

import type { SceneGraph, SceneNode, SharedStyle, SharedStyleKind, SharedStyleType } from './index'

const STYLE_REF_KEYS = {
  fill: 'fillStyleId',
  stroke: 'strokeStyleId',
  text: 'textStyleId',
  effect: 'effectStyleId',
  grid: 'gridStyleId'
} as const satisfies Record<SharedStyleKind, keyof SceneNode>

const STYLE_TYPES = {
  fill: 'FILL',
  stroke: 'FILL',
  text: 'TEXT',
  effect: 'EFFECT',
  grid: 'GRID'
} as const satisfies Record<SharedStyleKind, SharedStyleType>

/** Typography shared by a named text style and its consumers. */
export const SHARED_TEXT_STYLE_FIELDS = [
  'fontFamily',
  'fontWeight',
  'italic',
  'fontSize',
  'lineHeight',
  'letterSpacing',
  'textDecoration',
  'textCase',
  'fontFeatures'
] as const satisfies readonly (keyof SceneNode)[]

const TEXT_STYLE_KEYS = new Set<keyof SceneNode>(SHARED_TEXT_STYLE_FIELDS)
const TEXT_STYLE_BINDINGS = [...SHARED_TEXT_STYLE_FIELDS, 'fontStyle'] as const

/** Typography and its bindings travel together, independently of paint and text content. */
export function textStyleProperties(style: SceneNode): Partial<SceneNode> {
  return {
    ...structuredClone(pick(style, SHARED_TEXT_STYLE_FIELDS)),
    boundVariables: pick(style.boundVariables, TEXT_STYLE_BINDINGS),
    variableBindingScales: pick(style.variableBindingScales, TEXT_STYLE_BINDINGS)
  }
}

export function textStyleApplication(
  target: SceneNode,
  style: SceneNode,
  styleId: string
): Partial<SceneNode> {
  const properties = textStyleProperties(style)
  return {
    ...properties,
    textStyleId: styleId,
    boundVariables: {
      ...omit(target.boundVariables, TEXT_STYLE_BINDINGS),
      ...properties.boundVariables
    },
    variableBindingScales: {
      ...omit(target.variableBindingScales, TEXT_STYLE_BINDINGS),
      ...properties.variableBindingScales
    }
  }
}

export function textStyleMatches(target: SceneNode, style: SceneNode): boolean {
  const comparable = (node: SceneNode) => {
    const properties = textStyleProperties(node)
    // Stored values may differ between variable modes without overriding the style.
    return omit(
      properties,
      SHARED_TEXT_STYLE_FIELDS.filter((field) => node.boundVariables[field])
    )
  }
  return isEqual(comparable(target), comparable(style))
}

/** Inspector edits remain local changes to a named style until it is updated or detached. */
export function retainEditedTextStyle(
  node: SceneNode,
  changes: Partial<SceneNode>
): Partial<SceneNode> {
  if (
    node.textStyleId &&
    !Object.hasOwn(changes, 'textStyleId') &&
    (Object.keys(changes) as (keyof SceneNode)[]).some((key) => TEXT_STYLE_KEYS.has(key))
  )
    return { ...changes, textStyleId: node.textStyleId }
  return changes
}

export function sharedStyleRefKey(kind: SharedStyleKind): (typeof STYLE_REF_KEYS)[SharedStyleKind] {
  return STYLE_REF_KEYS[kind]
}

export function sharedStyleTypeForKind(kind: SharedStyleKind): SharedStyleType {
  return STYLE_TYPES[kind]
}

export function getSharedStyles(graph: SceneGraph, kind: SharedStyleKind): SharedStyle[] {
  const type = sharedStyleTypeForKind(kind)
  const styles: SharedStyle[] = []
  for (const node of graph.getAllNodes()) {
    if (node.sharedStyleType !== type || !node.source.id) continue
    styles.push({ id: node.source.id, nodeId: node.id, name: node.name, type })
  }
  return styles.sort((left, right) => left.name.localeCompare(right.name))
}

export function styleDetachmentChanges(
  node: SceneNode,
  changes: Partial<SceneNode>
): Partial<SceneNode> {
  const next = { ...changes }
  if ('fills' in changes && !('fillStyleId' in changes) && node.fillStyleId) {
    next.fillStyleId = null
  }
  if ('strokes' in changes && !('strokeStyleId' in changes) && node.strokeStyleId) {
    next.strokeStyleId = null
  }
  if ('effects' in changes && !('effectStyleId' in changes) && node.effectStyleId) {
    next.effectStyleId = null
  }
  if ('layoutGrids' in changes && !('gridStyleId' in changes) && node.gridStyleId) {
    next.gridStyleId = null
  }
  const changesTextStyle = (Object.keys(changes) as (keyof SceneNode)[]).some((key) =>
    TEXT_STYLE_KEYS.has(key)
  )
  if (changesTextStyle && !('textStyleId' in changes) && node.textStyleId) {
    next.textStyleId = null
  }
  return next
}
