import { isEqual } from 'es-toolkit/predicate'

import type { SceneGraph, SceneNode } from '../'
import { TEXT_METRIC_FIELDS, TEXT_SHAPING_FIELDS } from '../fields/text'
import { layoutSizing } from '../layout/sizing'

const METRIC_FIELDS: ReadonlySet<string> = new Set(TEXT_METRIC_FIELDS)

/**
 * The axes along which a copy sizes itself to its own content rather than to its component,
 * judged by the state the copy is about to have.
 */
function contentSizedAxes(
  graph: SceneGraph,
  current: SceneNode,
  source: SceneNode,
  updates: Partial<SceneNode>
): { width: boolean; height: boolean } {
  const copy: SceneNode = { ...current, ...updates }
  // Text measures its own characters and their style, set on the copy or by a property of an
  // instance around it; a copy styled as its component takes the component's measure.
  if (copy.type === 'TEXT') {
    if (TEXT_SHAPING_FIELDS.every((field) => isEqual(copy[field], source[field])))
      return { width: false, height: false }
    const mode = copy.textAutoResize
    return {
      width: mode === 'WIDTH_AND_HEIGHT',
      height: mode === 'WIDTH_AND_HEIGHT' || mode === 'HEIGHT'
    }
  }
  // Auto layout hugs the copy's own layers, which may show or size differently, and a layer
  // that fills its parent takes the size layout gives it there.
  const laidOut = (axis: 'HORIZONTAL' | 'VERTICAL') => {
    const sizing = layoutSizing(graph, copy, axis)
    return sizing === 'FILL' || (sizing === 'HUG' && copy.layoutMode !== 'NONE')
  }
  return { width: laidOut('HORIZONTAL'), height: laidOut('VERTICAL') }
}

/**
 * Keeps a copy's own size along the axes it sizes to its own content, as Figma sizes a badge to
 * its count and the layers it shows rather than to the component's placeholder. Layout measures
 * those axes; the component's size there would be stale.
 */
export function keepOwnContentSize(
  graph: SceneGraph,
  updates: Partial<SceneNode>,
  copy: SceneNode,
  source: SceneNode
): void {
  const axes = contentSizedAxes(graph, copy, source, updates)
  const parent = copy.parentId ? graph.getNode(copy.parentId) : undefined
  const free =
    parent &&
    parent.type !== 'CANVAS' &&
    (parent.layoutMode === 'NONE' ||
      (updates.layoutPositioning ?? copy.layoutPositioning) === 'ABSOLUTE')
  for (const [size, position, constraint] of [
    ['width', 'x', 'horizontalConstraint'],
    ['height', 'y', 'verticalConstraint']
  ] as const) {
    if (!axes[size]) continue
    // The incoming position was calculated with the source size. Keep its anchor
    // while retaining the copy's size, before layout measures its own content.
    if (free && updates[position] !== undefined) {
      const anchor = updates[constraint] ?? copy[constraint]
      let factor = 0
      if (anchor === 'MAX') factor = 1
      else if (anchor === 'CENTER') factor = 0.5
      updates[position] += ((updates[size] ?? source[size]) - copy[size]) * factor
    }
    Reflect.deleteProperty(updates, size)
  }
}

/**
 * Drops the size a text copy kept from the file once a metric reaches it from the component, so
 * layout measures its characters again instead of trusting the size Figma saved for the old style.
 */
export function remeasureChangedText(updates: Partial<SceneNode>, copy: SceneNode): void {
  if (copy.type !== 'TEXT' || !copy.derivedLayout) return
  if (Object.keys(updates).some((key) => METRIC_FIELDS.has(key))) updates.derivedLayout = null
}
