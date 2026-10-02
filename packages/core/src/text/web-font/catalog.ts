import * as v from 'valibot'

import { FONT_WEIGHT_NAMES, weightToStyle } from '@open-pencil/scene-graph'

import type { WebFontProviderId } from '#core/text/web-fonts'

const googleCatalog = v.array(
  v.object({
    family: v.string(),
    fonts: v.record(v.string(), v.unknown()),
    axes: v.optional(v.array(v.object({ tag: v.string(), min: v.number(), max: v.number() })), [])
  })
)
const fontsourceCatalog = v.array(
  v.object({
    family: v.string(),
    weights: v.array(v.number()),
    styles: v.array(v.string())
  })
)
const bunnyCatalog = v.record(
  v.string(),
  v.object({
    familyName: v.string(),
    weights: v.array(v.number()),
    styles: v.optional(v.array(v.string()))
  })
)
const fontshareCatalog = v.array(
  v.object({
    name: v.string(),
    styles: v.array(v.object({ is_italic: v.boolean(), weight: v.object({ weight: v.number() }) }))
  })
)

function namedStyles(weights: number[], styles: string[]): string[] {
  return [
    ...new Set(
      styles.flatMap((style) => weights.map((weight) => weightToStyle(weight, style !== 'normal')))
    )
  ]
}

/** Read the same provider metadata Unifont has already fetched for its family list. */
export function fontCatalogStyles(
  provider: WebFontProviderId,
  data: unknown
): Map<string, string[]> {
  const families = new Map<string, string[]>()
  if (provider === 'google') {
    const parsed = v.safeParse(googleCatalog, data)
    if (!parsed.success) return families
    for (const font of parsed.output) {
      const faces = Object.keys(font.fonts).flatMap((key) => {
        const match = /^(\d+)(i)?$/.exec(key)
        return match ? [{ weight: Number(match[1]), italic: Boolean(match[2]) }] : []
      })
      const axis = font.axes.find((entry) => entry.tag === 'wght')
      const styles = new Set(faces.map(({ weight, italic }) => weightToStyle(weight, italic)))
      if (axis) {
        for (const weight of Object.keys(FONT_WEIGHT_NAMES).map(Number)) {
          if (weight < axis.min || weight > axis.max) continue
          for (const italic of new Set(faces.map((face) => face.italic))) {
            styles.add(weightToStyle(weight, italic))
          }
        }
      }
      families.set(font.family, [...styles])
    }
  } else if (provider === 'fontsource') {
    const parsed = v.safeParse(fontsourceCatalog, data)
    if (parsed.success)
      for (const font of parsed.output) {
        families.set(font.family, namedStyles(font.weights, font.styles))
      }
  } else if (provider === 'bunny') {
    const parsed = v.safeParse(bunnyCatalog, data)
    if (parsed.success)
      for (const font of Object.values(parsed.output)) {
        if (font.styles) families.set(font.familyName, namedStyles(font.weights, font.styles))
      }
  } else {
    const parsed = v.safeParse(fontshareCatalog, data)
    if (parsed.success)
      for (const font of parsed.output) {
        families.set(
          font.name,
          font.styles.map((style) => weightToStyle(style.weight.weight, style.is_italic))
        )
      }
  }
  return families
}
