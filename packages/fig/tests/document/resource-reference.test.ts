import { expect, test } from 'bun:test'

import { createResourceResolver } from '#fig/document/resource-reference'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

test('an explicit unversioned record wins regardless of source ordering', () => {
  const entries: NodeChange[] = [
    { guid: { sessionID: 1, localID: 1 }, key: 'style' },
    { guid: { sessionID: 1, localID: 2 }, key: 'style', version: 'v2' }
  ]
  for (const records of [entries, entries.toReversed()]) {
    const resolve = createResourceResolver(records)
    expect(resolve({ assetRef: { key: 'style' } })).toBe('1:1')
    expect(resolve({ assetRef: { key: 'style', version: 'v2' } })).toBe('1:2')
    expect(resolve({ assetRef: { key: 'style', version: 'missing' } })).toBeUndefined()
  }
})

test('resolves exact resource versions and refuses ambiguous unversioned references', () => {
  const resolve = createResourceResolver([
    { guid: { sessionID: 1, localID: 1 }, key: 'collection', version: 'v1' },
    { guid: { sessionID: 1, localID: 2 }, key: 'collection', version: 'v2' }
  ] as NodeChange[])
  expect(resolve({ assetRef: { key: 'collection', version: 'v2' } })).toBe('1:2')
  expect(resolve({ assetRef: { key: 'collection', version: 'missing' } })).toBeUndefined()
  expect(resolve({ assetRef: { key: 'collection' } })).toBeUndefined()
  expect(resolve({ guid: { sessionID: 2, localID: 3 } })).toBe('2:3')
})

test('duplicate library identities do not block explicit local references', () => {
  const records: NodeChange[] = [
    { guid: { sessionID: 1, localID: 1 }, key: 'collection' },
    { guid: { sessionID: 1, localID: 2 }, key: 'collection' },
    { guid: { sessionID: 1, localID: 3 }, key: 'collection', version: 'v2' },
    { guid: { sessionID: 1, localID: 4 }, key: 'other' }
  ]
  for (const entries of [records, records.toReversed()]) {
    const resolve = createResourceResolver(entries)
    expect(resolve({ guid: { sessionID: 1, localID: 2 } })).toBe('1:2')
    expect(resolve({ guid: { sessionID: 1, localID: 1 }, assetRef: { key: 'collection' } })).toBe(
      '1:1'
    )
    expect(resolve({ assetRef: { key: 'other' } })).toBe('1:4')
    expect(resolve({ assetRef: { key: 'collection', version: 'v2' } })).toBe('1:3')
    expect(() => resolve({ assetRef: { key: 'collection' } })).toThrow('Ambiguous resource')
  }
})

test('duplicate versioned targets reject only the conflicting lookup', () => {
  const a: NodeChange = { guid: { sessionID: 1, localID: 1 }, key: 'library', version: 'v1' }
  const b: NodeChange = { guid: { sessionID: 1, localID: 2 }, key: 'library', version: 'v1' }
  expect(createResourceResolver([a, a])({ assetRef: { key: 'library', version: 'v1' } })).toBe(
    '1:1'
  )
  for (const entries of [
    [a, b, a],
    [b, a, b]
  ]) {
    const resolve = createResourceResolver(entries)
    expect(resolve({ assetRef: { key: 'library', version: 'missing' } })).toBeUndefined()
    expect(() => resolve({ assetRef: { key: 'library', version: 'v1' } })).toThrow(
      'Ambiguous resource'
    )
    expect(() => resolve({ assetRef: { key: 'library' } })).toThrow('Ambiguous resource')
  }
})
