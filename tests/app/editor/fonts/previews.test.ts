import { expect, test, vi } from 'bun:test'
import { setImmediate } from 'node:timers/promises'

import { createFontPreviewQueue } from '@/app/editor/fonts/previews'
import { createDeferred } from '@/app/runtime/deferred'

test('preview loading bounds concurrency and skips queued rows that leave view', async () => {
  const gate = createDeferred<ArrayBuffer | null>()
  const started: string[] = []
  const request = createFontPreviewQueue(async (family) => {
    started.push(family)
    return gate.promise
  })
  const releases = Array.from({ length: 10 }, (_, index) => request(`Font ${index}`, 'fontsource'))
  await setImmediate()
  expect(started).toHaveLength(4)
  for (const release of releases.slice(4)) release()
  gate.resolve(new ArrayBuffer(4))
  await setImmediate()
  expect(started).toEqual(['Font 0', 'Font 1', 'Font 2', 'Font 3'])
})

test('previews share pending downloads and reuse loaded fonts', async () => {
  const gate = createDeferred<ArrayBuffer | null>()
  const load = vi.fn(() => gate.promise)
  const request = createFontPreviewQueue(load)
  const first = request('Preview', 'google')
  request('Preview', 'google')
  first()
  await setImmediate()
  expect(load).toHaveBeenCalledTimes(1)
  gate.resolve(new ArrayBuffer(4))
  await setImmediate()
  request('Preview', 'google')
  request('Local', 'local')
  request('Bundled', 'bundled')
  await setImmediate()
  expect(load).toHaveBeenCalledTimes(1)
})

test('failed previews can retry when a row returns', async () => {
  let attempts = 0
  const request = createFontPreviewQueue(async () => {
    attempts++
    if (attempts === 1) throw new Error('Offline')
    return new ArrayBuffer(4)
  })
  request('Preview', 'fontsource')
  await setImmediate()
  request('Preview', 'fontsource')
  await setImmediate()
  expect(attempts).toBe(2)
})
