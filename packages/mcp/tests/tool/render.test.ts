import { expect, test } from 'bun:test'

import { Client, InMemoryTransport } from '@modelcontextprotocol/client'
import { McpServer } from '@modelcontextprotocol/server'

import { registerTools } from '#mcp/tool/registration'

test('a fresh MCP session accepts render first, preserves its payload, and rejects missing JSX', async () => {
  const server = new McpServer({ name: 'render-contract-test', version: '1' })
  const client = new Client({ name: 'render-contract-test', version: '1' })
  const requests: Record<string, unknown>[] = []
  registerTools(server, {
    policy: { allowEval: false, disabledTools: [] },
    sendRPC: async (body) => {
      requests.push(body)
      return { ok: true, result: { id: 'rendered' } }
    }
  })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  try {
    await server.connect(serverTransport)
    await client.connect(clientTransport)
    const first = await client.callTool({
      name: 'render',
      arguments: { jsx: '<Frame name="First" w={120} h={40} />', x: 24, page_id: 'page' }
    })
    expect(first.isError).not.toBe(true)
    expect(requests).toHaveLength(1)
    expect(requests[0]).toMatchObject({
      command: 'tool',
      args: {
        page_id: 'page',
        name: 'render',
        args: { x: 24, jsx: '<Frame name="First" w={120} h={40} />' }
      }
    })
    const missing = await client.callTool({ name: 'render', arguments: {} })
    expect(missing.isError).toBe(true)
    expect(requests).toHaveLength(1)
    const next = await client.callTool({
      name: 'render',
      arguments: { jsx: '<Frame name="Next" w={120} h={40} />' }
    })
    expect(next.isError).not.toBe(true)
    expect(requests).toHaveLength(2)
  } finally {
    await client.close()
    await server.close()
  }
})
