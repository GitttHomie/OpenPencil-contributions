import { afterEach, expect, test } from 'bun:test'

import type { RequestPermissionRequest, SessionUpdate } from '@agentclientprotocol/sdk'

import { getACPAgentAdapter } from '@/app/ai/acp/adapters/registry'
import {
  allowCanvasForChat,
  canAllowCanvasForChat,
  cancelPermissionsForScope,
  permissionQueue,
  cancelCurrentPermission,
  requestPermissionFromUser,
  respondToPermission
} from '@/app/ai/acp/permission'

function canvasScope(purpose: 'design' | 'review' = 'design') {
  return getACPAgentAdapter('kiro-cli').createSession({
    purpose,
    mcpServers: [{ type: 'http', name: 'open-pencil', url: 'http://localhost/mcp', headers: [] }]
  }).permissions
}

function request(id: string, name = 'get_selection'): RequestPermissionRequest {
  return {
    sessionId: 'session',
    toolCall: { toolCallId: id, title: `@open-pencil/${name}`, status: 'pending' },
    options: [
      { optionId: 'accept', name: 'Allow', kind: 'allow_once' },
      { optionId: 'always-accept', name: 'Always allow', kind: 'allow_always' },
      { optionId: 'reject', name: 'Deny', kind: 'reject_once' }
    ]
  }
}

function announcement(id: string, name = 'get_selection', server = 'open-pencil'): SessionUpdate {
  return {
    sessionUpdate: 'tool_call',
    toolCallId: id,
    title: `@${server}/${name}`,
    status: 'pending',
    rawInput: { tool_id: `${server}::${name}`, arguments: {} },
    _meta: { kiro: { serverName: server, toolOrigin: 'default' } }
  }
}

afterEach(() => {
  while (permissionQueue.value.length) cancelCurrentPermission()
})

test('canvas trust requires an explicit choice and applies to other canvas tools in this session', async () => {
  const scope = canvasScope()
  scope.observe(announcement('first'), 'session')
  const first = requestPermissionFromUser(request('first'), scope)
  expect(permissionQueue.value).toHaveLength(1)
  expect(canAllowCanvasForChat.value).toBe(true)
  expect(scope.trusted).toBe(false)
  allowCanvasForChat()
  expect(await first).toEqual({ outcome: { outcome: 'selected', optionId: 'accept' } })
  scope.observe(announcement('edit', 'update_node'), 'session')
  expect(await requestPermissionFromUser(request('edit', 'update_node'), scope)).toEqual({
    outcome: { outcome: 'selected', optionId: 'accept' }
  })
  expect(permissionQueue.value).toHaveLength(0)
  const nextSession = canvasScope()
  expect(nextSession.trusted).toBe(false)
})

test('bulk approval leaves filesystem, other servers, and unverified titles pending', async () => {
  const scope = canvasScope()
  scope.observe(announcement('canvas'), 'session')
  const canvas = requestPermissionFromUser(request('canvas'), scope)
  scope.observe(announcement('file', 'save_file'), 'session')
  scope.observe(announcement('remote', 'get_selection', 'other-server'), 'session')
  const file = requestPermissionFromUser(request('file', 'save_file'), scope)
  const remote = requestPermissionFromUser(request('remote'), scope)
  const titleOnly = requestPermissionFromUser(request('unannounced'), scope)
  allowCanvasForChat()
  await canvas
  expect(permissionQueue.value).toHaveLength(3)
  expect(canAllowCanvasForChat.value).toBe(false)
  cancelPermissionsForScope(scope)
  expect(await Promise.all([file, remote, titleOnly])).toEqual([
    { outcome: { outcome: 'cancelled' } },
    { outcome: { outcome: 'cancelled' } },
    { outcome: { outcome: 'cancelled' } }
  ])
})

test('one-time approval does not grant group trust and unknown response IDs are ignored', async () => {
  const scope = canvasScope()
  scope.observe(announcement('one'), 'session')
  const pending = requestPermissionFromUser(request('one'), scope)
  respondToPermission('not-offered')
  expect(permissionQueue.value).toHaveLength(1)
  respondToPermission('accept')
  await pending
  expect(scope.trusted).toBe(false)
})

test('unsupported sessions cannot offer canvas group approval', () => {
  const scope = canvasScope('review')
  scope.observe(announcement('one'), 'session')
  expect(scope.canApprove(request('one'))).toBe(false)
})
