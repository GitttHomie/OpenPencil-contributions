import { afterEach, expect, test, vi } from 'bun:test'

import { Client } from '@modelcontextprotocol/client'

import { permissionQueue, respondToPermission } from '@/app/ai/acp/permission'
import { mcpConnectionSettingsSnapshot, replaceMCPConnectionSettings } from '@/app/integrations/mcp'
import { createExternalMCPTools } from '@/app/integrations/mcp/tools'

const before = mcpConnectionSettingsSnapshot()
afterEach(() => {
  replaceMCPConnectionSettings(before)
  vi.restoreAllMocks()
})

async function fixture(autoApprove: string[] = []) {
  replaceMCPConnectionSettings({
    version: 1,
    connections: [
      {
        id: 'mcp-example',
        name: 'Example',
        enabled: true,
        transport: { type: 'stdio', command: 'example-server', args: [] },
        authentication: { type: 'none' },
        autoApprove
      }
    ]
  })
  const client = new Client({ name: 'fixture', version: '1' })
  const call = vi.spyOn(client, 'callTool').mockResolvedValue({
    content: [{ type: 'text', text: 'Result' }]
  })
  const close = vi.fn(async () => undefined)
  const connect = vi.fn(async () => ({
    client,
    close,
    tools: [{ name: 'inspect', inputSchema: { type: 'object' as const, properties: {} } }]
  }))
  const session = await createExternalMCPTools(['mcp-example'], connect)
  const execute = Object.values(session.tools)[0]?.execute
  if (!execute) throw new Error('Expected an executable tool')
  return { session, execute, call, close, connect }
}

test('empty autoApprove waits for an explicit decision and never borrows canvas trust', async () => {
  const f = await fixture()
  try {
    const pending = f.execute({}, { toolCallId: 'call', messages: [] })
    expect(f.call).not.toHaveBeenCalled()
    expect(permissionQueue.value[0]?.request.toolCall.title).toContain('Example')
    respondToPermission('allow')
    await pending
    expect(f.call).toHaveBeenCalledTimes(1)
  } finally {
    await f.session.close()
  }
  expect(permissionQueue.value).toHaveLength(0)
  expect(f.close).toHaveBeenCalledTimes(1)
})

test('exact approval skips the prompt; cancelling an unapproved request never executes it', async () => {
  const approved = await fixture(['inspect'])
  try {
    await approved.execute({}, { toolCallId: 'approved', messages: [] })
    expect(approved.call).toHaveBeenCalledTimes(1)
    expect(permissionQueue.value).toHaveLength(0)
  } finally {
    await approved.session.close()
  }
  const blocked = await fixture()
  try {
    const controller = new AbortController()
    const pending = blocked.execute(
      {},
      { toolCallId: 'cancelled', messages: [], abortSignal: controller.signal }
    )
    controller.abort()
    await expect(pending).rejects.toThrow()
    expect(blocked.call).not.toHaveBeenCalled()
    expect(permissionQueue.value).toHaveLength(0)
  } finally {
    await blocked.session.close()
  }
})

test('an unselected server is never connected', async () => {
  const f = await fixture()
  try {
    f.connect.mockClear()
    const empty = await createExternalMCPTools([], f.connect)
    expect(empty.tools).toEqual({})
    expect(f.connect).not.toHaveBeenCalled()
    await empty.close()
  } finally {
    await f.session.close()
  }
})
