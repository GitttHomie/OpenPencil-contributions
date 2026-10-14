import { expect, test } from 'bun:test'

import { toUint8Array } from 'js-base64'

import { createSessionCapture } from '@/app/ai/chat/logging/capture'
import { sessionLogText, SESSION_LOG_TEXT_LIMIT } from '@/app/ai/chat/logging/types'

const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEAQH/69cbGAAAAABJRU5ErkJggg=='

test('logs requests, coalesced responses, permissions, tools and errors in sequence', () => {
  let now = 10
  const capture = createSessionCapture(
    'session',
    'run',
    () => undefined,
    () => now
  )
  capture.record('request', { text: 'Make a settings page' })
  capture.observe({ type: 'reasoning-delta', id: 'r', delta: 'Use ' })
  now += 20
  capture.observe({ type: 'reasoning-delta', id: 'r', delta: 'existing components.' })
  capture.observe({
    type: 'tool-input-available',
    toolCallId: 't',
    toolName: 'render',
    input: { jsx: '<Frame />' }
  })
  capture.record('permission.response', { toolCallId: 't', outcome: 'selected', optionId: 'allow' })
  capture.observe({ type: 'tool-output-error', toolCallId: 't', errorText: 'Missing parent' })
  capture.finish('failed')
  expect(capture.log.events.map((event) => event.type)).toEqual([
    'request',
    'reasoning-delta',
    'tool-input-available',
    'permission.response',
    'tool-output-error',
    'run.finish'
  ])
  expect(capture.log.events[1]).toMatchObject({
    elapsedMs: 20,
    data: { text: 'Use existing components.' }
  })
  expect(capture.log.status).toBe('failed')
})

test('keeps original images separate from text, deduplicates and redacts credentials', () => {
  const capture = createSessionCapture('session', 'run', () => undefined)
  capture.record('tool.input', {
    image_data: PNG,
    env: { SECRET: 'private' },
    api_key: 'private-key'
  })
  capture.record('tool.output', { content: [{ type: 'image', data: PNG, mimeType: 'image/png' }] })
  capture.record('text', { text: 'Authorization: Bearer xyz-secret' })
  capture.finish('completed')
  const text = sessionLogText(capture.log)
  expect(text).not.toContain(PNG)
  expect(text).not.toContain('private')
  expect(text).not.toContain('xyz-secret')
  expect(text).toContain('images/1.png')
  expect(capture.log.assets).toHaveLength(1)
  expect(capture.log.assets[0].bytes).toEqual(toUint8Array(PNG))
})

test('limits runaway responses and still records the final status', () => {
  const capture = createSessionCapture('session', 'run', () => undefined)
  capture.record('text', 'x'.repeat(SESSION_LOG_TEXT_LIMIT + 1))
  capture.record('text', 'this should not be retained')
  capture.finish('stopped')
  expect(capture.log.events).toHaveLength(1)
  expect(sessionLogText(capture.log)).not.toContain('this should not be retained')
  expect(capture.log.status).toBe('stopped')
})
