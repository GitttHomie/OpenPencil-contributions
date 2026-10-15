import { expect, test } from 'bun:test'

import type { McpServer } from '@agentclientprotocol/sdk'

import { ACP_AGENTS } from '@open-pencil/core/constants'

import { createConnectedAgent } from '#tests/helpers/agents/acp-session'

const servers: McpServer[] = [
  { name: 'open-pencil', type: 'http', url: 'http://localhost/canvas', headers: [] },
  { name: 'team-assets', command: '/tools/assets', args: [], env: [] }
]

for (const id of ['codex', 'claude-code'] as const) {
  for (const purpose of ['design', 'verification'] as const) {
    test(`${id} scopes ${purpose} sessions independently of the selected model`, async () => {
      const definition = ACP_AGENTS.find((agent) => agent.id === id)
      if (!definition) throw new Error('Adapter missing')
      for (const modelId of ['fast', 'strong']) {
        const agent = createConnectedAgent(definition, false, undefined, false, false, {
          modelId,
          responseText: 'OK',
          mcpServers: servers,
          ...(purpose === 'verification' ? { purpose } : {})
        })
        try {
          if (purpose === 'verification') {
            await agent.transport.verifyModel()
          } else {
            const stream = await agent.transport.sendMessages({
              chatId: 'scope-test',
              trigger: 'submit-message',
              messages: [
                { id: 'user', role: 'user', parts: [{ type: 'text', text: 'Inspect selection' }] }
              ]
            })
            for await (const chunk of stream) expect(chunk.type).not.toBe('error')
          }
          const expected = purpose === 'design' ? servers : []
          const supplied = agent.sessions[0].mcpServers
          if (id === 'codex') {
            expect(agent.launches[0].mcpScope).toEqual({
              cwd: '/workspace',
              serverNames: supplied.map(({ name }) => name)
            })
            expect(supplied.map(({ name: _name, ...server }) => server)).toEqual(
              expected.map(({ name: _name, ...server }) => server)
            )
            for (const server of supplied) {
              expect(expected.map(({ name }) => name)).not.toContain(server.name)
              expect(agent.prompts[0]).toContain(server.name)
            }
          } else {
            expect(supplied).toEqual(expected)
            expect(agent.sessions[0]._meta).toEqual({
              claudeCode: { options: { strictMcpConfig: true } }
            })
          }
        } finally {
          await agent.dispose()
        }
      }
    })
  }
}

test('session server aliases preserve tool identity without rewriting inputs from other servers', async () => {
  const { scopeMCPServers } = await import('@/app/ai/acp/adapters/mcp-scope')
  const scope = scopeMCPServers(servers)
  const next = scopeMCPServers(servers)
  const name = scope.mcpServers[0].name
  expect(next.mcpServers[0].name).not.toBe(name)
  expect(servers[0].name).toBe('open-pencil')
  const call = {
    sessionUpdate: 'tool_call' as const,
    toolCallId: 'inspect',
    title: `${name} · get_selection`,
    rawInput: { server: name, tool: 'get_selection', arguments: { label: name } }
  }
  expect(scope.normalizeUpdate(call)).toMatchObject({
    title: 'open-pencil · get_selection',
    rawInput: {
      server: 'open-pencil',
      tool: 'get_selection',
      arguments: { label: name }
    }
  })
  expect(next.normalizeUpdate(call)).toEqual(call)
  expect(
    scope.normalizeUpdate({
      sessionUpdate: 'tool_call_update',
      toolCallId: 'inspect',
      title: `mcp__${name}__get_selection`,
      status: 'completed'
    })
  ).toMatchObject({ title: 'mcp__open-pencil__get_selection' })
})
