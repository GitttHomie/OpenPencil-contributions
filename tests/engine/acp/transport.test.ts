import { describe, expect, test, spyOn } from 'bun:test'

import type { UIMessageChunk } from 'ai'
import { reactive } from 'vue'

import { ACP_AGENTS } from '@open-pencil/core/constants'
import { DESIGN_WORKFLOW } from '@open-pencil/core/tools'

import { ACPChatTransport, formatConnectionError, buildCrashChunks } from '@/app/ai/acp/transport'
import { classifyAIChatError } from '@/app/ai/chat/failure'
import { MCPStartupError } from '@/app/automation/mcp/failure'
import { createDeferred } from '@/app/runtime/deferred'

import { createConnectedAgent } from '#tests/helpers/agents/acp-session'

const TEXT_ID = 'text-1'

function send(transport: ACPChatTransport, abortSignal?: AbortSignal) {
  return transport.sendMessages({
    chatId: 'test-chat',
    messages: reactive([
      { id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'Make a card' }] }
    ]),
    trigger: 'submit-message',
    abortSignal
  })
}

async function collect(stream: ReadableStream<UIMessageChunk>): Promise<UIMessageChunk[]> {
  const chunks: UIMessageChunk[] = []
  for await (const chunk of stream) chunks.push(chunk)
  return chunks
}

for (const agentDef of ACP_AGENTS) {
  describe(`${agentDef.name} ACP chat sessions`, () => {
    const connectedAgent = createConnectedAgent.bind(null, agentDef)
    test('reactive chat messages preserve agent-specific instructions on every design turn', async () => {
      const agent = connectedAgent()
      try {
        await collect(await send(agent.transport))
        await collect(await send(agent.transport))
        expect(agent.prompts).toHaveLength(2)
        for (const prompt of agent.prompts) {
          if (agentDef.id !== 'kiro-cli') {
            expect(prompt).not.toContain('## Kiro tool dispatch')
            continue
          }
          expect(prompt).toContain('## Kiro tool dispatch')
          expect(prompt).toMatch(
            /"tool_id"\s*:\s*"open-pencil::render",\s*"arguments"\s*:\s*\{\s*"jsx"\s*:/
          )
        }
      } finally {
        await agent.dispose()
      }
    })
    for (const outcome of ['complete', 'abort', 'invalid-model'] as const) {
      test(`presence starts before process startup and clears on ${outcome}`, async () => {
        const gate = createDeferred<undefined>()
        const abort = new AbortController()
        let visible = false
        const agent = connectedAgent(false, gate.promise, false, false, {
          modelId: outcome === 'invalid-model' ? 'missing' : undefined,
          activity: {
            start: () => {
              visible = true
            },
            update: () => undefined,
            finish: () => {
              visible = false
            }
          }
        })
        try {
          const response = send(agent.transport, abort.signal)
          await agent.spawning
          expect(visible).toBe(true)
          if (outcome === 'abort') {
            abort.abort()
            expect(visible).toBe(false)
          }
          gate.resolve(undefined)
          if (outcome === 'invalid-model') await expect(response).rejects.toThrow()
          else await collect(await response)
          expect(visible).toBe(false)
        } finally {
          gate.resolve(undefined)
          await agent.dispose()
        }
      })
    }
    test('live configuration updates remove unavailable thinking choices before the next prompt', async () => {
      const changed = createDeferred<undefined>()
      const agent = connectedAgent(false, undefined, false, false, {
        thinking: () => ({ configId: 'reasoning', value: 'deep' }),
        onCatalog: (catalog) => {
          if (catalog.thinking?.currentValue === 'quick') changed.resolve(undefined)
        }
      })
      try {
        await collect(await send(agent.transport))
        await agent.notify({
          sessionUpdate: 'config_option_update',
          configOptions: [
            {
              type: 'select',
              id: 'reasoning',
              name: 'Thinking',
              category: 'thought_level',
              currentValue: 'quick',
              options: [{ value: 'quick', name: 'Quick' }]
            }
          ]
        })
        await changed.promise
        await expect(send(agent.transport)).rejects.toThrow('no longer offers')
        expect(agent.prompts).toHaveLength(1)
      } finally {
        await agent.dispose()
      }
    })
    for (const review of [false, true]) {
      test(`applies thinking before ${review ? 'review' : 'chat'} and restores the CLI default`, async () => {
        let choice: ACPThinkingSelection | undefined = { configId: 'reasoning', value: 'deep' }
        const agent = connectedAgent(false, undefined, review, false, {
          modelId: 'fast',
          thinking: () => choice
        })
        try {
          await collect(await send(agent.transport))
          choice = undefined
          await collect(await send(agent.transport))
          expect(agent.modelEvents).toEqual([
            'select:fast',
            'thinking:deep',
            'prompt:fast',
            'prompt-thinking:deep',
            'thinking:balanced',
            'prompt:fast',
            'prompt-thinking:balanced'
          ])
        } finally {
          await agent.dispose()
        }
      })
    }
    test('an unavailable thinking choice fails before the agent receives a prompt', async () => {
      const agent = connectedAgent(false, undefined, false, false, {
        thinking: () => ({ configId: 'reasoning', value: 'missing' })
      })
      try {
        await expect(send(agent.transport)).rejects.toThrow('no longer offers')
        expect(agent.prompts).toEqual([])
      } finally {
        await agent.dispose()
      }
    })
    for (const stopReason of ['max_tokens', 'max_turn_requests', 'cancelled', 'refusal'] as const) {
      test(`${stopReason} does not report successful completion`, async () => {
        const agent = connectedAgent(false, undefined, false, false, { stopReason })
        try {
          const chunks = await collect(await send(agent.transport))
          expect(chunks.at(-1)).toEqual({
            type: 'finish',
            finishReason:
              stopReason === 'max_tokens' || stopReason === 'max_turn_requests' ? 'length' : 'other'
          })
        } finally {
          await agent.dispose()
        }
      })
    }
    for (const reviewing of [false, true]) {
      test(`applies the saved model before ${reviewing ? 'review' : 'chat'} prompts`, async () => {
        const agent = connectedAgent(false, undefined, reviewing, false, { modelId: 'fast' })
        try {
          await collect(await send(agent.transport))
          expect(agent.modelEvents).toEqual(['select:fast', 'prompt:fast'])
        } finally {
          await agent.dispose()
        }
      })
    }
    test('model discovery neither connects MCP nor sends prompts', async () => {
      const agent = connectedAgent(false, undefined, false, false, { purpose: 'catalog' })
      try {
        const models = await agent.transport.listModels()
        expect(models.models.map((model) => model.id)).toEqual(['strong', 'fast'])
        expect(agent.sessions[0].mcpServers).toEqual([])
        expect(agent.modelEvents).toEqual([])
        await expect(send(agent.transport)).rejects.toThrow()
      } finally {
        await agent.dispose()
      }
    })
    test('a missing saved model stops before any prompt instead of using the default', async () => {
      const agent = connectedAgent(false, undefined, false, false, { modelId: 'retired' })
      try {
        await expect(send(agent.transport)).rejects.toThrow('Model not found')
        expect(agent.modelEvents).toEqual([])
        expect(agent.closed()).toBe(true)
      } finally {
        await agent.dispose()
      }
    })
    for (const supportsImages of [true, false]) {
      test(`review sessions omit MCP, deny permissions, and respect image capability ${supportsImages}`, async () => {
        const agent = connectedAgent(false, undefined, true, supportsImages)
        try {
          await collect(await send(agent.transport))
          expect(agent.sessions[0].mcpServers).toEqual([])
          expect(agent.permissions).toEqual([{ outcome: { outcome: 'cancelled' } }])
          expect(agent.prompts[0]).not.toContain(DESIGN_WORKFLOW)
          expect(agent.images).toEqual(supportsImages ? ['AQID'] : [])
          expect(agent.transport.imageIncluded).toBe(supportsImages)
          if (!supportsImages) expect(agent.prompts[0]).toContain('No screenshot is available')
        } finally {
          await agent.dispose()
        }
      })
    }
    test('cleans up a process that spawns after its transport is destroyed', async () => {
      const spawning = createDeferred<undefined>()
      const agent = connectedAgent(false, spawning.promise)
      const pending = send(agent.transport)
      await agent.spawning
      await agent.transport.destroy()
      spawning.resolve(undefined)
      await expect(pending).rejects.toThrow('Agent connection was closed.')
      expect(agent.closed()).toBe(true)
      expect(agent.sessions).toHaveLength(0)
      await agent.dispose()
    })

    test('reports missing canvas setup before launch without classifying it as a model failure', async () => {
      let spawned = false
      const error = new MCPStartupError('MCP automation is not installed.', {
        code: 'not-installed'
      })
      const transport = new ACPChatTransport(
        {
          agentDef
        },
        {
          async spawn() {
            spawned = true
            throw new Error('Agent must not start without its canvas connection')
          },
          async mcpServers() {
            throw error
          }
        }
      )
      await expect(send(transport)).rejects.toBe(error)
      expect(classifyAIChatError(error).reason).toBe('mcp-unavailable')
      expect(spawned).toBe(false)
      await transport.destroy()
    })

    test('finishes each successful prompt and passes canvas MCP configuration without an API key', async () => {
      const agent = connectedAgent()
      const errors = spyOn(console, 'error').mockImplementation(() => undefined)
      try {
        const chunks = await collect(await send(agent.transport))
        expect(agent.prompts[0]).toContain(DESIGN_WORKFLOW)
        expect(chunks).toContainEqual({ type: 'text-delta', id: expect.any(String), delta: 'Done' })
        expect(chunks.at(-1)).toEqual({ type: 'finish', finishReason: 'stop' })
        expect(agent.sessions[0]).toMatchObject({
          cwd: '/workspace',
          mcpServers: [
            {
              name: 'open-pencil',
              headers: [{ name: 'Authorization', value: 'Bearer test-token' }]
            }
          ]
        })
        const second = await collect(await send(agent.transport))
        expect(agent.prompts[1].length).toBeLessThan(agent.prompts[0].length)
        expect(second.at(-1)).toEqual({ type: 'finish', finishReason: 'stop' })
        expect(agent.sessions).toHaveLength(1)
        expect(errors).not.toHaveBeenCalled()
      } finally {
        errors.mockRestore()
        await agent.dispose()
      }
    })

    test('cancels an active prompt and settles the message stream once', async () => {
      const agent = connectedAgent(true)
      const abort = new AbortController()
      try {
        const stream = await send(agent.transport, abort.signal)
        const chunks = collect(stream)
        await agent.started
        abort.abort()
        const result = await chunks
        expect(result.filter((chunk) => chunk.type === 'finish')).toHaveLength(1)
        expect(result.at(-1)).toEqual({ type: 'finish', finishReason: 'stop' })
      } finally {
        await agent.dispose()
      }
    })

    test('a process crash ends a pending response with an error', async () => {
      const agent = connectedAgent(true)
      try {
        const chunks = collect(await send(agent.transport))
        await agent.started
        await agent.crash()
        const result = await chunks
        expect(result).toContainEqual({
          type: 'error',
          errorText: 'Agent process exited unexpectedly.'
        })
        expect(result.at(-1)).toEqual({ type: 'finish', finishReason: 'error' })
      } finally {
        await agent.dispose()
      }
    })
  })
}

describe('formatConnectionError', () => {
  const claudeAgent = {
    id: 'claude-code',
    name: 'Claude Code',
    command: 'claude-agent-acp',
    args: [],
    installCommand: 'npm i -g @agentclientprotocol/claude-agent-acp'
  } as const

  test('ECONNREFUSED maps to MCP not running', () => {
    const msg = formatConnectionError(new Error('connect ECONNREFUSED 127.0.0.1:7600'))
    expect(msg).toBe('MCP server is not running. Make sure the editor is open.')
  })

  test('fetch failed maps to MCP not running', () => {
    const msg = formatConnectionError(new Error('fetch failed'))
    expect(msg).toBe('MCP server is not running. Make sure the editor is open.')
  })

  test('timeout maps to timeout message', () => {
    const msg = formatConnectionError(new Error('Request timeout after 30s'))
    expect(msg).toBe('MCP server did not respond in time.')
  })

  test('ENOENT maps to install instructions', () => {
    const msg = formatConnectionError(new Error('spawn claude-agent-acp ENOENT'), claudeAgent)
    expect(msg).toBe(
      '"claude-agent-acp" is not installed. Install it with: npm i -g @agentclientprotocol/claude-agent-acp'
    )
  })

  test('other errors pass through', () => {
    const msg = formatConnectionError(new Error('Something unexpected'))
    expect(msg).toBe('Something unexpected')
  })

  test('non-Error values converted to string', () => {
    const msg = formatConnectionError('raw string error')
    expect(msg).toBe('raw string error')
  })
})

describe('buildCrashChunks', () => {
  test('destroying=true returns empty chunks, no session null', () => {
    const result = buildCrashChunks(true, TEXT_ID, false)
    expect(result.chunks).toEqual([])
    expect(result.shouldNullSession).toBe(false)
  })

  test('destroying=false with no text emits error + finish', () => {
    const result = buildCrashChunks(false, TEXT_ID, false)
    expect(result.shouldNullSession).toBe(true)
    expect(result.chunks).toEqual([
      { type: 'error', errorText: 'Agent process exited unexpectedly.' },
      { type: 'finish-step' },
      { type: 'finish', finishReason: 'error' }
    ])
  })

  test('destroying=false with active text emits text-end before error', () => {
    const result = buildCrashChunks(false, TEXT_ID, true)
    expect(result.shouldNullSession).toBe(true)
    expect(result.chunks[0]).toEqual({ type: 'text-end', id: TEXT_ID })
    expect(result.chunks[1]).toEqual({
      type: 'error',
      errorText: 'Agent process exited unexpectedly.'
    })
  })
})
