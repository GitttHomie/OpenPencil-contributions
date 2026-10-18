import { expect, test } from 'bun:test'

import { cssReferenceProperty, cssValueTokens } from '@open-pencil/scene-graph/css'

const kinds = (source: string) =>
  cssValueTokens(source).map(({ kind, text }) => `${kind}:${text.trim()}`)

test('a finished var() is one reference token; math reads as functions, numbers and operators', () => {
  expect(kinds('clamp(1rem, 4vw, var(--space-md))')).toEqual([
    'function:clamp',
    'paren:(',
    'number:1rem',
    'separator:,',
    'number:4vw',
    'separator:,',
    'reference:var(--space-md)',
    'paren:)'
  ])
  expect(kinds('calc(var(--a) * 2 / 3)')).toEqual([
    'function:calc',
    'paren:(',
    'reference:var(--a)',
    'operator:*',
    'number:2',
    'operator:/',
    'number:3',
    'paren:)'
  ])
  const [reference] = cssValueTokens('var( --space-md )')
  expect(reference && cssReferenceProperty(reference)).toBe('--space-md')
})

test('half-typed values still give the tokens completion needs', () => {
  expect(kinds('var(--sp')).toEqual(['function:var', 'paren:(', 'property:--sp'])
  expect(kinds('clamp(1rem, var(')).toEqual([
    'function:clamp',
    'paren:(',
    'number:1rem',
    'separator:,',
    'function:var',
    'paren:('
  ])
  // A var() with a fallback is not a plain reference, so it stays editable text.
  expect(kinds('var(--a, 4px)')).toEqual([
    'function:var',
    'paren:(',
    'property:--a',
    'separator:,',
    'number:4px',
    'paren:)'
  ])
})
