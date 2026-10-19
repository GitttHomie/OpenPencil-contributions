import type { TokenUnit } from '@open-pencil/scene-graph'
import {
  cssReferenceProperty,
  cssValueTokens,
  type CSSValueToken
} from '@open-pencil/scene-graph/css'

/** A property that takes values of the token's unit, which the browser checks the CSS against. */
const PROPERTY_FOR_UNIT: Record<TokenUnit, string> = {
  none: 'opacity',
  px: 'width',
  rem: 'width',
  '%': 'width',
  ms: 'transition-duration',
  s: 'transition-duration',
  deg: 'rotate'
}

/** The custom property a token names, in `var(--name)` or as a bare `--name`. */
function propertyName(token: CSSValueToken) {
  if (token.kind === 'reference') return cssReferenceProperty(token)
  return token.kind === 'property' ? token.text : undefined
}

export type CSSExpressionProblem =
  | { kind: 'unclosed' }
  | { kind: 'negated-reference'; property: string }
  | { kind: 'unknown-token'; name: string }
  | { kind: 'invalid'; property: string }

/**
 * Why a CSS expression cannot stand in for a token, if it cannot: an unclosed function, a
 * `var()` naming no token, or a value the token's kind of property does not take. A value
 * holding `var()` is checked only for its names, since browsers accept it until it is used.
 */
export function cssExpressionProblem(
  css: string,
  unit: TokenUnit,
  tokens: ReadonlySet<string>,
  supports: (property: string, value: string) => boolean
): CSSExpressionProblem | undefined {
  const parsed = cssValueTokens(css)
  const opened = parsed.filter((token) => token.kind === 'paren' && token.text === '(').length
  const closed = parsed.filter((token) => token.kind === 'paren' && token.text === ')').length
  if (opened !== closed) return { kind: 'unclosed' }
  // `-var(--x)` reads as a function named `-var`: CSS negates a value only inside calc().
  const negated = parsed.findIndex((token) => token.kind === 'function' && token.text === '-var')
  if (negated !== -1) {
    const name = parsed.slice(negated).find((token) => token.kind === 'property')?.text
    if (name) return { kind: 'negated-reference', property: name }
  }
  for (const token of parsed) {
    const name = propertyName(token)
    if (name && !tokens.has(name)) return { kind: 'unknown-token', name }
  }
  const property = PROPERTY_FOR_UNIT[unit]
  return supports(property, css) ? undefined : { kind: 'invalid', property }
}

/** Where the browser computes a preview: a property whose computed value is the plain number. */
const PREVIEW_PROPERTY: Partial<Record<TokenUnit, string>> = {
  none: 'scale',
  px: 'width',
  rem: 'width',
  ms: 'transition-duration',
  s: 'transition-duration',
  deg: 'rotate'
}
/**
 * Units that resolve against the window, a container or the text, which a preview can only
 * approximate. `rem` is exact: tokens and the app both take the root as 16px.
 */
const APPROXIMATE_UNITS = /\d(?:[sld]?v(?:w|h|i|b|min|max)|cq\w+|em|ex|ch|lh)\b/

export interface CSSExpressionPreview {
  /** The value in stored units, as a number token holds it: pixels, milliseconds, degrees. */
  value: number
  /** Whether it depends on the window or the text, so it holds only where it was computed. */
  approximate: boolean
}

/**
 * What a CSS expression comes to, computed by the browser with the tokens it names: `measure`
 * applies the value to `property` with those custom properties and reads the computed value.
 * Percentages, which resolve against a container, have no preview.
 */
export function cssExpressionPreview(
  css: string,
  unit: TokenUnit,
  tokens: ReadonlyMap<string, string>,
  measure: (property: string, value: string, variables: ReadonlyMap<string, string>) => string
): CSSExpressionPreview | undefined {
  const property = PREVIEW_PROPERTY[unit]
  if (!property || css.includes('%')) return undefined
  const names = cssValueTokens(css).flatMap((token) => {
    const name = propertyName(token)
    return name ? [name] : []
  })
  const variables = new Map(
    names.flatMap((name) => {
      const value = tokens.get(name)
      return value ? [[name, value] as const] : []
    })
  )
  if (variables.size !== new Set(names).size) return undefined
  const computed = measure(property, css, variables)
  const number = Number.parseFloat(computed)
  if (!Number.isFinite(number)) return undefined
  // Durations compute in seconds; the token holds milliseconds unless its unit is seconds.
  const value = property === 'transition-duration' && unit === 'ms' ? number * 1000 : number
  const approximate =
    APPROXIMATE_UNITS.test(css) ||
    [...variables.values()].some((text) => APPROXIMATE_UNITS.test(text))
  return { value, approximate }
}
