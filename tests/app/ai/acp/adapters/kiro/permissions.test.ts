import { afterEach, expect, test } from 'bun:test'

import type { RequestPermissionRequest, SessionUpdate } from '@agentclientprotocol/sdk'

import { kiroCanvasToolName } from '@/app/ai/acp/adapters/kiro/permissions'
import { getACPAgentAdapter } from '@/app/ai/acp/adapters/registry'
import { rememberedCanvasApprovals, resetCanvasApprovals } from '@/app/ai/acp/canvas/approvals'
import { createCanvasPermissionScope } from '@/app/ai/acp/canvas/permissions'
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
  resetCanvasApprovals()
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

test('Always allow survives new sessions for only the verified tool and agent', async () => {
  const first = canvasScope()
  first.observe(announcement('original'), 'session')
  const pending = requestPermissionFromUser(request('original'), first)
  respondToPermission('always-accept')
  expect(await pending).toEqual({ outcome: { outcome: 'selected', optionId: 'always-accept' } })
  cancelPermissionsForScope(first)

  const second = canvasScope()
  second.observe(announcement('new-call'), 'session')
  const next = request('new-call')
  next.options[0].optionId = 'allow-this-call'
  expect(await requestPermissionFromUser(next, second)).toEqual({
    outcome: { outcome: 'selected', optionId: 'allow-this-call' }
  })
  expect(second.trusted).toBe(false)
  expect(second.isRemembered({ ...next, sessionId: 'different-session' })).toBe(false)
  second.observe(announcement('edit', 'update_node'), 'session')
  expect(second.isRemembered(request('edit', 'update_node'))).toBe(false)
  const otherAgent = createCanvasPermissionScope(kiroCanvasToolName, 'other-agent')
  otherAgent.observe(announcement('new-call'), 'session')
  expect(otherAgent.isRemembered(next)).toBe(false)
  const review = canvasScope('review')
  review.observe(announcement('new-call'), 'session')
  expect(review.isRemembered(next)).toBe(false)

  resetCanvasApprovals()
  void requestPermissionFromUser(next, second)
  expect(permissionQueue.value).toHaveLength(1)
})

test('remembered permissions still require verified current tool identity', async () => {
  const scope = canvasScope()
  scope.observe(announcement('allowed'), 'session')
  const pending = requestPermissionFromUser(request('allowed'), scope)
  respondToPermission('always-accept')
  await pending
  scope.observe(announcement('remote', 'get_selection', 'other-server'), 'session')
  scope.observe(announcement('unknown', 'save_file'), 'session')
  scope.observe(announcement('reused'), 'session')
  scope.observe(announcement('reused', 'get_selection', 'other-server'), 'session')
  for (const id of ['remote', 'unknown', 'reused', 'unannounced']) {
    const pending = requestPermissionFromUser(request(id), scope)
    expect(permissionQueue.value).toHaveLength(1)
    respondToPermission('always-accept')
    await pending
  }
  expect(rememberedCanvasApprovals.value).toEqual([{ agent: 'kiro-cli', tool: 'get_selection' }])
})

test('one-time and chat approvals are not remembered by subsequent sessions', async () => {
  for (const action of ['once', 'chat']) {
    const scope = canvasScope()
    scope.observe(announcement('one'), 'session')
    const pending = requestPermissionFromUser(request('one'), scope)
    if (action === 'once') respondToPermission('accept')
    else allowCanvasForChat()
    await pending
    const next = canvasScope()
    next.observe(announcement('one'), 'session')
    expect(next.isRemembered(request('one'))).toBe(false)
    expect(rememberedCanvasApprovals.value).toEqual([])
  }
})

test('Always allow releases queued calls of the same tool without approving a different tool', async () => {
  const scope = canvasScope()
  scope.observe(announcement('first'), 'session')
  scope.observe(announcement('second'), 'session')
  scope.observe(announcement('edit', 'update_node'), 'session')
  const first = requestPermissionFromUser(request('first'), scope)
  const second = requestPermissionFromUser(request('second'), scope)
  const edit = requestPermissionFromUser(request('edit', 'update_node'), scope)
  respondToPermission('always-accept')
  expect(await first).toEqual({ outcome: { outcome: 'selected', optionId: 'always-accept' } })
  expect(await second).toEqual({ outcome: { outcome: 'selected', optionId: 'accept' } })
  expect(permissionQueue.value.map((entry) => entry.request.toolCall.toolCallId)).toEqual(['edit'])
  cancelCurrentPermission()
  expect(await edit).toEqual({ outcome: { outcome: 'cancelled' } })
})
