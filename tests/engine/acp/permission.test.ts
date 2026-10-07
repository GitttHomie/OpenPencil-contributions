import { describe, expect, test, beforeEach } from 'bun:test'

import type { RequestPermissionRequest } from '@agentclientprotocol/sdk'

import {
  permissionQueue,
  currentPermission,
  requestPermissionFromUser,
  respondToPermission,
  cancelCurrentPermission
} from '@/app/ai/acp/permission'

function makeRequest(
  options: { optionId: string; kind: string; name: string }[] = [
    { optionId: 'allow', kind: 'allow_once', name: 'Allow once' },
    { optionId: 'reject', kind: 'reject_once', name: 'Reject' }
  ]
): RequestPermissionRequest {
  return {
    sessionId: 'session-1',
    options: options.map((o) => ({
      optionId: o.optionId,
      kind: o.kind as 'allow_once' | 'allow_always' | 'reject_once' | 'reject_always',
      name: o.name
    })),
    toolCall: {
      sessionUpdate: 'tool_call_update',
      toolCallId: 'tc-1',
      status: 'pending' as const
    }
  }
}

describe('acp-permission', () => {
  beforeEach(() => {
    permissionQueue.value = []
  })

  test('requestPermissionFromUser queues an entry', () => {
    void requestPermissionFromUser(makeRequest())
    expect(permissionQueue.value).toHaveLength(1)
    expect(currentPermission.value).not.toBeNull()
    expect(currentPermission.value?.request.sessionId).toBe('session-1')
    respondToPermission('allow')
  })

  test('respondToPermission resolves with selected optionId', async () => {
    const promise = requestPermissionFromUser(makeRequest())
    respondToPermission('allow')
    const result = await promise
    expect(result.outcome.outcome).toBe('selected')
    expect(result.outcome.optionId).toBe('allow')
    expect(permissionQueue.value).toHaveLength(0)
  })

  test('an explicit rejection returns the selected reject option', async () => {
    const promise = requestPermissionFromUser(makeRequest())
    respondToPermission('reject')
    const result = await promise
    expect(result.outcome.optionId).toBe('reject')
  })

  test('cancelCurrentPermission cancels when no reject option is offered', async () => {
    const req = makeRequest([{ optionId: 'only-allow', kind: 'allow_once', name: 'Allow' }])
    const promise = requestPermissionFromUser(req)
    cancelCurrentPermission()
    const result = await promise
    expect(result.outcome.outcome).toBe('cancelled')
  })

  test('queue handles multiple concurrent requests in order', async () => {
    const p1 = requestPermissionFromUser(
      makeRequest([{ optionId: 'a1', kind: 'allow_once', name: 'First' }])
    )
    const p2 = requestPermissionFromUser(
      makeRequest([{ optionId: 'a2', kind: 'allow_once', name: 'Second' }])
    )
    expect(permissionQueue.value).toHaveLength(2)
    expect(currentPermission.value?.request.options[0].optionId).toBe('a1')

    respondToPermission('a1')
    const r1 = await p1
    expect(r1.outcome.optionId).toBe('a1')
    expect(currentPermission.value?.request.options[0].optionId).toBe('a2')

    respondToPermission('a2')
    const r2 = await p2
    expect(r2.outcome.optionId).toBe('a2')
    expect(permissionQueue.value).toHaveLength(0)
  })

  test('respondToPermission is no-op when queue is empty', () => {
    expect(permissionQueue.value).toHaveLength(0)
    respondToPermission('anything')
    expect(permissionQueue.value).toHaveLength(0)
  })

  test('cancelCurrentPermission is no-op when queue is empty', () => {
    expect(permissionQueue.value).toHaveLength(0)
    cancelCurrentPermission()
    expect(permissionQueue.value).toHaveLength(0)
  })

  test('cancelling does not select rejection even when permanent rejection is offered first', async () => {
    const promise = requestPermissionFromUser(
      makeRequest([
        { optionId: 'never', kind: 'reject_always', name: 'Never allow' },
        { optionId: 'once', kind: 'allow_once', name: 'Allow' }
      ])
    )
    cancelCurrentPermission()
    expect(await promise).toEqual({ outcome: { outcome: 'cancelled' } })
    expect(permissionQueue.value).toHaveLength(0)
  })
})
