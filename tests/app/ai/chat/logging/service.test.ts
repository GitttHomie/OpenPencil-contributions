import 'fake-indexeddb/auto'
import { expect, test } from 'bun:test'

import { nextTick } from 'vue'

import {
  recordSessionEvent,
  sessionLoggingEnabled,
  sessionLogs,
  startSessionLog
} from '@/app/ai/chat/logging/service'

test('logging can be disabled and cleared without reviving an active capture', async () => {
  const enabled = sessionLoggingEnabled.value
  try {
    await sessionLogs.clear()
    sessionLoggingEnabled.value = true
    const id = crypto.randomUUID()
    const capture = startSessionLog('chat', id, { text: 'Make a card' })
    capture?.observe({ type: 'text-delta', id: 'text', delta: 'Planning a card' })
    recordSessionEvent(id, 'permission.response', { optionId: 'allow' })
    expect((await sessionLogs.list())[0].status).toBe('running')
    sessionLoggingEnabled.value = false
    await nextTick()
    capture?.observe({ type: 'text-delta', id: 'text', delta: 'Not recorded' })
    expect(startSessionLog('chat', crypto.randomUUID(), {})).toBeNull()
    const logs = await sessionLogs.list()
    expect(logs[0].status).toBe('stopped')
    expect(JSON.stringify(logs)).not.toContain('Not recorded')
    await sessionLogs.clear()
    capture?.finish('completed')
    expect(await sessionLogs.list()).toEqual([])
  } finally {
    await sessionLogs.clear()
    sessionLoggingEnabled.value = enabled
  }
})
