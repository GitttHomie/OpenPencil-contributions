import 'fake-indexeddb/auto'
import { expect, test } from 'bun:test'

import { createSessionLogStore } from '@/app/ai/chat/logging/store'
import type { SessionLog } from '@/app/ai/chat/logging/types'

test('retains twenty runs and restores their image bytes, then clears them', async () => {
  const store = createSessionLogStore()
  await store.clear()
  const expired: string[] = []
  for (let i = 0; i < 22; i++) {
    const log: SessionLog = {
      version: 1,
      id: String(i),
      sessionId: 'chat',
      startedAt: i,
      status: 'completed',
      events: [],
      assets: [{ name: 'images/1.png', mimeType: 'image/png', bytes: new Uint8Array([1, 2, 3]) }]
    }
    expired.push(...(await store.write(log)))
  }
  expect(expired).toEqual(['0', '1'])
  const logs = await store.list()
  expect(logs).toHaveLength(20)
  expect(logs[0].id).toBe('21')
  expect(logs[0].assets[0].bytes).toEqual(new Uint8Array([1, 2, 3]))
  await store.clear()
  expect(await store.list()).toEqual([])
})
