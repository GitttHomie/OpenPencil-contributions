import { expect, test } from 'bun:test'

import { FontManager } from '#core/text/fonts'

test('concurrent requests share one native font read and reuse the registered bytes', async () => {
  const manager = new FontManager()
  const data = new ArrayBuffer(8)
  let reads = 0
  let finish: ((data: ArrayBuffer) => void) | undefined
  manager.setHostFontLoader(() => {
    reads++
    return new Promise<ArrayBuffer>((resolve) => {
      finish = resolve
    })
  })
  const first = manager.loadLocalFont('Local', 'Regular')
  const second = manager.loadLocalFont('Local', 'Regular')
  expect(reads).toBe(1)
  finish?.(data)
  expect(await first).toBe(data)
  expect(await second).toBe(data)
  expect(await manager.loadLocalFont('Local', 'Regular')).toBe(data)
  expect(reads).toBe(1)
})

test('a failed native read can be retried', async () => {
  const manager = new FontManager()
  let reads = 0
  manager.setHostFontLoader(async () => (++reads === 1 ? null : new ArrayBuffer(8)))
  expect(await manager.loadLocalFont('Local', 'Regular')).toBeNull()
  expect(await manager.loadLocalFont('Local', 'Regular')).not.toBeNull()
  expect(reads).toBe(2)
})
