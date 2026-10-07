import { expect, test } from 'bun:test'

import type { McpServer, SessionUpdate } from '@agentclientprotocol/sdk'

import { ACP_AGENTS } from '@open-pencil/core/constants'

import { acpToolPresentation, getACPAgentAdapter } from '@/app/ai/acp/adapters/registry'

const canvas: McpServer = {
  type: 'http',
  name: 'open-pencil',
  url: 'http://localhost/mcp',
  headers: []
}
const announcement: SessionUpdate = {
  sessionUpdate: 'tool_call',
  toolCallId: 'selection',
  title: '@open-pencil/get_selection',
  status: 'pending',
  rawInput: { tool_id: 'open-pencil::get_selection' },
  _meta: { kiro: { serverName: 'open-pencil' } }
}

for (const definition of ACP_AGENTS) {
  test(`${definition.name} isolates session trust and interprets only its own tool identity`, () => {
    const adapter = getACPAgentAdapter(definition.id)
    expect(adapter.id).toBe(definition.id)
    const options = { purpose: 'design' as const, mcpServers: [canvas] }
    const first = adapter.createSession(options)
    const second = adapter.createSession(options)
    first.permissions.trusted = true
    expect(second.permissions.trusted).toBe(false)
    second.permissions.observe(announcement, 'session')
    expect(
      second.permissions.canApprove({
        sessionId: 'session',
        toolCall: { toolCallId: 'selection', title: '@open-pencil/get_selection' },
        options: [{ kind: 'allow_once', name: 'Allow', optionId: 'allow' }]
      })
    ).toBe(definition.id === 'kiro-cli')
  })
}

test('Kiro startup waits only for the matching session and notification', async () => {
  const session = getACPAgentAdapter('kiro-cli').createSession({
    purpose: 'design',
    mcpServers: [canvas]
  })
  const abort = new AbortController()
  let ready = false
  const waiting = session.ready?.('current', abort.signal).then(() => {
    ready = true
    return undefined
  })
  try {
    const status = { sessionId: 'current', servers: [{ name: 'open-pencil', status: 'connected' }] }
    await session.notification?.('_other/mcp/status', status)
    await session.notification?.('_kiro/mcp/status', { ...status, sessionId: 'other' })
    expect(ready).toBe(false)
    await session.notification?.('_kiro/mcp/status', status)
    await waiting
    expect(ready).toBe(true)
  } finally {
    abort.abort()
    await waiting
  }
})

for (const definition of ACP_AGENTS) {
  for (const purpose of ['review', 'catalog'] as const) {
    test(`${definition.name} ${purpose} needs no canvas readiness and cannot grant group trust`, async () => {
      const session = getACPAgentAdapter(definition.id).createSession({
        purpose,
        mcpServers: [canvas]
      })
      await session.ready?.('session', new AbortController().signal)
      session.permissions.observe(announcement, 'session')
      expect(
        session.permissions.canApprove({
          sessionId: 'session',
          toolCall: { toolCallId: 'selection', title: '@open-pencil/get_selection' },
          options: []
        })
      ).toBe(false)
    })
  }
}

test('adapter tool labels preserve historical names without renaming ordinary canvas tools', () => {
  expect(acpToolPresentation('Kiro Powers')).toEqual({
    label: 'kiroExtensions',
    description: 'kiroExtensionsHint'
  })
  expect(acpToolPresentation('tool_load')).toEqual({ label: 'loadAgentTools' })
  for (const name of ['render', 'get_selection', 'constructor', '__proto__']) {
    expect(acpToolPresentation(name)).toBeUndefined()
  }
})
