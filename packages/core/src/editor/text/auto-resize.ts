import { TEXT_METRIC_FIELDS, type SceneNode } from '@open-pencil/scene-graph'

import { estimateTextSize, getTextMeasurer } from '#core/layout/text-measurement'

export const TEXT_AUTO_RESIZE_KEYS = new Set<keyof SceneNode>([
  ...TEXT_METRIC_FIELDS,
  'lineHeight',
  'textAutoResize',
  'width',
  'maxLines'
])

const TEXT_AUTO_WIDTH_KEYS = new Set<keyof SceneNode>([...TEXT_METRIC_FIELDS, 'textAutoResize'])

export function hasTextAutoResizeChange(changes: Partial<SceneNode>): boolean {
  return Object.keys(changes).some((key) => TEXT_AUTO_RESIZE_KEYS.has(key as keyof SceneNode))
}

function hasTextAutoWidthChange(changes: Partial<SceneNode>): boolean {
  return Object.keys(changes).some((key) => TEXT_AUTO_WIDTH_KEYS.has(key as keyof SceneNode))
}

/** Explicit geometry edits fix the edited text axis; font and text edits keep its sizing mode. */
export function manualTextSizingChanges(
  node: SceneNode,
  changes: Partial<SceneNode>
): Partial<Pick<SceneNode, 'textAutoResize'>> {
  if (node.type !== 'TEXT' || node.textPathData || changes.textAutoResize !== undefined) return {}
  if (changes.height !== undefined && changes.height !== node.height) {
    return node.textAutoResize === 'NONE' ? {} : { textAutoResize: 'NONE' }
  }
  if (
    changes.width !== undefined &&
    changes.width !== node.width &&
    node.textAutoResize === 'WIDTH_AND_HEIGHT'
  ) {
    return { textAutoResize: 'HEIGHT' }
  }
  return {}
}

export function textAutoResizeChanges(
  node: SceneNode | undefined,
  changes: Partial<SceneNode>
): Partial<Pick<SceneNode, 'width' | 'height' | 'derivedLayout' | 'derivedTextGlyphs'>> {
  if (node?.type !== 'TEXT' || !hasTextAutoResizeChange(changes)) return {}
  // Path text is laid out along its path (derivedTextGlyphs on textPathBox),
  // not by paragraph auto-resize. Running the measurement here would null the
  // derived glyphs — destroying the on-path lettering — whenever an imported
  // TEXT_PATH carries textAutoResize HEIGHT/WIDTH_AND_HEIGHT and a keystroke
  // can't reflow (font outlines or the layout path unavailable). pathTextEditChanges
  // owns path-text reflow; leave its glyphs alone.
  if (node.textPathData) return {}

  const next = { ...node, ...changes }
  const mode = next.textAutoResize
  if (mode !== 'HEIGHT' && mode !== 'WIDTH_AND_HEIGHT') return {}

  const maxWidth = mode === 'HEIGHT' ? next.width : undefined
  const measured = getTextMeasurer()?.(next, maxWidth) ?? estimateTextSize(next, maxWidth)
  const resized: Partial<
    Pick<SceneNode, 'width' | 'height' | 'derivedLayout' | 'derivedTextGlyphs'>
  > = { derivedLayout: null, derivedTextGlyphs: null }

  if (mode === 'WIDTH_AND_HEIGHT' && hasTextAutoWidthChange(changes) && measured.width > 0)
    resized.width = measured.width
  if (measured.height > 0) resized.height = measured.height

  return resized
}
