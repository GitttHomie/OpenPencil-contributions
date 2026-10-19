import { expect, test } from 'bun:test'

import { cssExpressionPreview, cssExpressionProblem } from '@/app/editor/tokens/css-expression'

const tokens = new Set(['--space-md'])
/** A stand-in for CSS.supports: lengths and numbers, and anything holding var(). */
const supports = (property: string, value: string) =>
  value.includes('var(') ||
  (property === 'width' ? /^(clamp|calc)\(|^\d+(px|rem|vw)$/.test(value) : /^\d+$/.test(value))

test('a CSS expression must close its functions, name tokens that exist and suit its unit', () => {
  expect(cssExpressionProblem('clamp(1rem, 4vw, var(--space-md))', 'px', tokens, supports)).toBe(
    undefined
  )
  expect(cssExpressionProblem('clamp(1rem, 4vw', 'px', tokens, supports)).toEqual({
    kind: 'unclosed'
  })
  expect(cssExpressionProblem('calc(var(--missing) * 2)', 'px', tokens, supports)).toEqual({
    kind: 'unknown-token',
    name: '--missing'
  })
  expect(cssExpressionProblem('var(--space-md, 4px)', 'px', tokens, supports)).toBe(undefined)
  expect(cssExpressionProblem('-var(--space-md)', 'px', tokens, supports)).toEqual({
    kind: 'negated-reference',
    property: '--space-md'
  })
  expect(cssExpressionProblem('4 apples', 'px', tokens, supports)).toEqual({
    kind: 'invalid',
    property: 'width'
  })
  expect(cssExpressionProblem('4px', 'none', tokens, supports)).toEqual({
    kind: 'invalid',
    property: 'opacity'
  })
})

test('a CSS expression previews what the browser computes, in stored units', () => {
  const calls: Array<[string, string, string[]]> = []
  /** A stand-in for the browser: every value computes to 20 of the property's unit. */
  const measure = (property: string, value: string, variables: ReadonlyMap<string, string>) => {
    calls.push([property, value, [...variables.keys()]])
    return property === 'transition-duration' ? '0.15s' : '20px'
  }
  const tokens = new Map([['--space-md', '8px']])
  expect(cssExpressionPreview('calc(12px + var(--space-md))', 'px', tokens, measure)).toEqual({
    value: 20,
    approximate: false
  })
  expect(calls.at(-1)).toEqual(['width', 'calc(12px + var(--space-md))', ['--space-md']])
  expect(cssExpressionPreview('clamp(1rem, 4vw, 2rem)', 'rem', tokens, measure)).toEqual({
    value: 20,
    approximate: true
  })
  expect(cssExpressionPreview('calc(100ms + 50ms)', 'ms', tokens, measure)?.value).toBe(150)
  // A percentage resolves against a container, and an unknown token has no value to use.
  expect(cssExpressionPreview('50%', 'px', tokens, measure)).toBeUndefined()
  expect(cssExpressionPreview('var(--missing)', 'px', tokens, measure)).toBeUndefined()
  expect(cssExpressionPreview('4px', '%', tokens, measure)).toBeUndefined()
})
