import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { expect, test } from '@playwright/test'

import { ACP_AGENTS } from '@open-pencil/core/constants'

import { runCanvasAgent } from '#tests/helpers/agents/live'
import { CanvasHelper } from '#tests/helpers/canvas'

const agent = ACP_AGENTS.find((candidate) => candidate.id === process.env.OPENPENCIL_LIVE_AGENT)

test(
  'CLI interprets building an app as editing the canvas',
  { tag: '@real-llm' },
  async ({ page }, testInfo) => {
    test.skip(!agent, 'Set OPENPENCIL_LIVE_AGENT to an installed, signed-in CLI to run this test.')
    if (!agent) return
    test.setTimeout(150_000)
    await page.goto('/?test')
    await new CanvasHelper(page).waitForInit()
    const token = await page.evaluate(async () => {
      const path = '/src/app/automation/mcp/spawn.ts'
      const { getAutomationAuthToken } = await import(path)
      return getAutomationAuthToken() as Promise<string | null>
    })
    const url = `http://127.0.0.1:${process.env.OPENPENCIL_TEST_MCP_PORT ?? '7600'}/mcp`
    const headers = token ? [{ name: 'Authorization', value: `Bearer ${token}` }] : []
    const session = await runCanvasAgent(
      agent,
      { type: 'http', name: 'open-pencil', url, headers },
      'Build a playful horse-matching app called Hay. Make just one compact mobile screen with a title, a profile card, and two choice buttons. Use simple shapes instead of photos. Keep it to at most eight tool calls.'
    )
    await testInfo.attach('agent-session', {
      body: JSON.stringify(session),
      contentType: 'application/json'
    })
    expect(session.result.stopReason).toBe('end_turn')
    const calls = session.updates.filter((update) => update.sessionUpdate === 'tool_call')
    expect(calls.length).toBeGreaterThan(0)
    // The empty test workspace must not become an application project.
    expect(calls.map((call) => call.title).join('\n')).not.toMatch(
      /write_file|fs_write|execute_bash|shell_command|apply_patch/i
    )
    const client = new Client({ name: 'canvas-verification', version: '1' })
    try {
      await client.connect(
        new StreamableHTTPClientTransport(new URL(url), {
          requestInit: {
            headers: Object.fromEntries(headers.map(({ name, value }) => [name, value]))
          }
        })
      )
      for (const type of ['FRAME', 'TEXT']) {
        const result = await client.callTool({ name: 'find_nodes', arguments: { type } })
        expect(result.isError).not.toBe(true)
        expect(JSON.stringify(result.content)).toContain(type)
      }
      await page.screenshot({ path: testInfo.outputPath('cli-canvas.png') })
    } finally {
      await client.close()
    }
  }
)
