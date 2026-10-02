import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

import {
  getOpenPencilPluginValue,
  TEXT_DIRECTION_PLUGIN_KEY,
  TEXT_LAYOUT_PLUGIN_KEY
} from '../plugin-data'
import { convertLineHeight } from './values'

function near(actual: number | undefined, expected: number): boolean {
  return actual !== undefined && Math.abs(actual - expected) < 0.001
}

/**
 * Native text uses the paragraph engine. Its exported outline fallback used to
 * be mistaken for an authoritative layout, flattening wrapped text on reopen.
 * Imported Figma outlines and path text must retain their original geometry.
 */
export function usesParagraphTextLayout(nc: NodeChange): boolean {
  if (nc.type !== 'TEXT') return false
  const source = getOpenPencilPluginValue(nc, TEXT_LAYOUT_PLUGIN_KEY)
  if (source !== null) return source === 'paragraph'
  return hasLegacyParagraphFallback(nc)
}

function hasLegacyParagraphFallback(nc: NodeChange): boolean {
  // Before the explicit marker, our writer emitted this exact combination of
  // a synthetic baseline and evenly divided character offsets. Ownership alone
  // is insufficient: genuine Figma outlines can also be re-saved by OpenPencil.
  if (
    getOpenPencilPluginValue(nc, TEXT_DIRECTION_PLUGIN_KEY) === null ||
    nc.textUserLayoutVersion !== 4 ||
    nc.textExplicitLayoutVersion !== 1 ||
    nc.textBidiVersion !== 1 ||
    nc.fontVersion !== ''
  ) {
    return false
  }
  return hasLegacyParagraphGeometry(nc)
}

function hasLegacyParagraphGeometry(nc: NodeChange): boolean {
  const derived = nc.derivedTextData
  const text = nc.textData?.characters
  const fontSize = nc.fontSize
  if (
    !derived?.layoutSize ||
    derived.baselines?.length !== 1 ||
    text === undefined ||
    fontSize === undefined
  ) {
    return false
  }
  const baseline = derived.baselines[0]
  const lineHeight = convertLineHeight(nc.lineHeight, fontSize) ?? Math.ceil(fontSize * 1.2)
  const advance = derived.layoutSize.x / Math.max(text.length, 1)
  const offsets = derived.logicalIndexToCharacterOffsetMap
  return (
    baseline.firstCharacter === 0 &&
    baseline.endCharacter === Math.max(text.length - 1, 0) &&
    near(baseline.position.x, 0) &&
    near(baseline.position.y, lineHeight) &&
    near(baseline.width, derived.layoutSize.x) &&
    near(baseline.lineHeight, lineHeight) &&
    near(baseline.lineAscent, Math.max(lineHeight - fontSize * 0.2, 0)) &&
    offsets?.length === text.length + 1 &&
    offsets.every((offset, index) => near(offset, index * advance)) &&
    (derived.glyphs ?? []).every((glyph) => near(glyph.position.y, lineHeight))
  )
}
