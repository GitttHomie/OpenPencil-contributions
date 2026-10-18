import { expect, test } from 'bun:test'

import { cssExpressionProblem } from '@/app/editor/tokens/css-expression'

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
