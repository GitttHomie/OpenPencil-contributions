import { expect, test } from 'bun:test'

import type { RequestPermissionRequest, SessionUpdate } from '@agentclientprotocol/sdk'

import { createCanvasPermissionScope } from '@/app/ai/acp/canvas/permissions'

function announcement(title: string): SessionUpdate {
  return { sessionUpdate: 'tool_call', toolCallId: 'call', title, status: 'pending' }
}

function request(sessionId = 'session', title = 'get_selection'): RequestPermissionRequest {
  return { sessionId, toolCall: { toolCallId: 'call', title }, options: [] }
}

test('the shared scope rejects tools outside the canvas catalog even when an adapter identifies them', () => {
  const scope = createCanvasPermissionScope((update) => update.title)
  scope.observe(announcement('get_selection'), 'session')
  expect(scope.canApprove(request())).toBe(true)
  expect(scope.canApprove(request('other'))).toBe(false)
  expect(scope.canApprove(request('session', 'update_node'))).toBe(false)
  scope.observe(announcement('shell'), 'session')
  expect(scope.canApprove(request('session', 'shell'))).toBe(false)
  expect(scope.canApprove(request())).toBe(false)
})

test('an unidentified repeated tool call revokes its earlier verified identity', () => {
  const scope = createCanvasPermissionScope((update) =>
    update.title === 'get_selection' ? update.title : undefined
  )
  scope.observe(announcement('get_selection'), 'session')
  expect(scope.canApprove(request())).toBe(true)
  scope.observe(announcement('unverified'), 'session')
  expect(scope.canApprove(request())).toBe(false)
  const standard = createCanvasPermissionScope()
  standard.observe(announcement('get_selection'), 'session')
  expect(standard.canApprove(request())).toBe(false)
})
