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
