import { describe, expect, test, spyOn } from 'bun:test'

import {
  AgentSideConnection,
  ndJsonStream,
  PROTOCOL_VERSION,
  type NewSessionRequest,
  type PromptResponse,
  type SessionUpdate
} from '@agentclientprotocol/sdk'
import type { UIMessageChunk } from 'ai'

import { ACP_AGENTS } from '@open-pencil/core/constants'

import { mapUpdate } from '@/app/ai/acp/map-update'
import { ACPChatTransport, formatConnectionError, buildCrashChunks } from '@/app/ai/acp/transport'
import { classifyAIChatError } from '@/app/ai/chat/failure'
import { MCPStartupError } from '@/app/automation/mcp/failure'
import { createDeferred } from '@/app/runtime/deferred'

import { expectDefined } from '#tests/helpers/assert'

const TEXT_ID = 'text-1'

function connectedAgent(waitForCancel = false, beforeSpawn?: Promise<void>) {
  let toAgent: ReadableStreamDefaultController<Uint8Array> | undefined
  let toClient: ReadableStreamDefaultController<Uint8Array> | undefined
  const agentInput = new ReadableStream<Uint8Array>({
    start(controller) {
      toAgent = controller
    }
  })
  const clientOutput = new ReadableStream<Uint8Array>({
    start(controller) {
      toClient = controller
    }
  })
  const agentOutput = new WritableStream<Uint8Array>({
    write(chunk) {
      toClient?.enqueue(chunk)
    }
  })
  const clientInput = new WritableStream<Uint8Array>({
    write(chunk) {
      toAgent?.enqueue(chunk)
    }
  })
  const completion = createDeferred<PromptResponse>()
  const started = createDeferred<undefined>()
  const spawning = createDeferred<undefined>()
  const sessions: NewSessionRequest[] = []
  let cancelled = 0
  let closed = false
  let unexpectedClose = () => undefined
  const child = {
    pid: 1,
    async write() {
      throw new Error('The fake ACP process uses byte streams directly.')
    },
    async kill() {
      if (closed) return
      closed = true
      toAgent?.close()
      toClient?.close()
    }
  }
  const connection = new AgentSideConnection(
    (client) => ({
      initialize: async () => ({ protocolVersion: PROTOCOL_VERSION, agentCapabilities: {} }),
      newSession: async (request) => {
        sessions.push(request)
        return { sessionId: 'session-test' }
      },
      authenticate: async () => ({}),
      prompt: async ({ sessionId }) => {
        await client.extNotification('_kiro/mcp/status', { sessionId, servers: [] })
        await client.sessionUpdate({
          sessionId,
          update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'Done' } }
        })
        started.resolve(undefined)
        return waitForCancel ? completion.promise : { stopReason: 'end_turn' }
      },
      cancel: async () => {
        cancelled++
        completion.resolve({ stopReason: 'cancelled' })
      }
    }),
    ndJsonStream(agentOutput, agentInput)
  )
  const transport = new ACPChatTransport(
    {
      agentDef: expectDefined(
        ACP_AGENTS.find((agent) => agent.id === 'kiro-cli'),
        'Kiro'
      ),
      cwd: '/workspace'
    },
    {
      spawn: async (options) => {
        spawning.resolve(undefined)
        await beforeSpawn
        unexpectedClose = options.onUnexpectedClose
        return { child, input: clientInput, output: clientOutput }
      },
      mcpServers: async () => [
        {
          type: 'http',
          name: 'openpencil',
          url: 'http://127.0.0.1:7600/mcp',
          headers: [{ name: 'Authorization', value: 'Bearer test-token' }]
        }
      ]
    }
  )
  return {
    transport,
    sessions,
    started: started.promise,
    spawning: spawning.promise,
    cancelled: () => cancelled,
    closed: () => closed,
    async crash() {
      unexpectedClose()
      await child.kill()
    },
    async dispose() {
      await transport.destroy()
      await connection.closed
    }
  }
}

function send(transport: ACPChatTransport, abortSignal?: AbortSignal) {
  return transport.sendMessages({
    chatId: 'test-chat',
    messages: [{ id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'Make a card' }] }],
    trigger: 'submit-message',
    abortSignal
  })
}

async function collect(stream: ReadableStream<UIMessageChunk>): Promise<UIMessageChunk[]> {
  const chunks: UIMessageChunk[] = []
  for await (const chunk of stream) chunks.push(chunk)
  return chunks
}

describe('ACP chat sessions', () => {
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

  test('reports missing canvas setup without launching Kiro or classifying it as a model failure', async () => {
    let spawned = false
    const error = new MCPStartupError('MCP automation is not installed.', { code: 'not-installed' })
    const transport = new ACPChatTransport(
      {
        agentDef: expectDefined(
          ACP_AGENTS.find((agent) => agent.id === 'kiro-cli'),
          'Kiro'
        )
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
      expect(chunks).toContainEqual({ type: 'text-delta', id: expect.any(String), delta: 'Done' })
      expect(chunks.at(-1)).toEqual({ type: 'finish', finishReason: 'stop' })
      expect(agent.sessions[0]).toMatchObject({
        cwd: '/workspace',
        mcpServers: [
          { name: 'openpencil', headers: [{ name: 'Authorization', value: 'Bearer test-token' }] }
        ]
      })
      const second = await collect(await send(agent.transport))
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

describe('mapUpdate', () => {
  test('agent_message_chunk with non-empty text starts text and emits delta', () => {
    const update: SessionUpdate = {
      sessionUpdate: 'agent_message_chunk',
      content: { type: 'text', text: 'Hello' }
    }
    const result = mapUpdate(update, TEXT_ID, false)
    expect(result.textStarted).toBe(true)
    expect(result.chunks).toEqual([
      { type: 'text-start', id: TEXT_ID },
      { type: 'text-delta', id: TEXT_ID, delta: 'Hello' }
    ])
  })

  test('agent_message_chunk with empty text is skipped', () => {
    const update: SessionUpdate = {
      sessionUpdate: 'agent_message_chunk',
      content: { type: 'text', text: '' }
    }
    const result = mapUpdate(update, TEXT_ID, false)
    expect(result.textStarted).toBe(false)
    expect(result.chunks).toEqual([])
  })

  test('subsequent agent_message_chunk does not re-emit text-start', () => {
    const update: SessionUpdate = {
      sessionUpdate: 'agent_message_chunk',
      content: { type: 'text', text: 'world' }
    }
    const result = mapUpdate(update, TEXT_ID, true)
    expect(result.textStarted).toBe(true)
    expect(result.chunks).toEqual([{ type: 'text-delta', id: TEXT_ID, delta: 'world' }])
  })

  test('agent_thought_chunk emits reasoning start/delta/end', () => {
    const update: SessionUpdate = {
      sessionUpdate: 'agent_thought_chunk',
      content: { type: 'text', text: 'thinking...' }
    }
    const result = mapUpdate(update, TEXT_ID, false)
    expect(result.chunks).toHaveLength(3)
    expect(result.chunks[0].type).toBe('reasoning-start')
    expect(result.chunks[1]).toEqual({
      type: 'reasoning-delta',
      id: `reasoning-${TEXT_ID}`,
      delta: 'thinking...'
    })
    expect(result.chunks[2].type).toBe('reasoning-end')
  })

  test('tool_call emits tool-input-start', () => {
    const update: SessionUpdate = {
      sessionUpdate: 'tool_call',
      toolCallId: 'tc-1',
      title: 'create_shape',
      kind: 'edit',
      status: 'pending'
    }
    const result = mapUpdate(update, TEXT_ID, false)
    expect(result.chunks).toEqual([
      {
        type: 'tool-input-start',
        toolCallId: 'tc-1',
        toolName: 'create_shape',
        providerExecuted: true,
        title: 'create_shape'
      }
    ])
  })

  test('tool_call with rawInput emits tool-input-available', () => {
    const update: SessionUpdate = {
      sessionUpdate: 'tool_call',
      toolCallId: 'tc-2',
      title: 'set_fill',
      kind: 'edit',
      status: 'pending',
      rawInput: { id: '1:2', color: '#ff0000' }
    }
    const result = mapUpdate(update, TEXT_ID, false)
    expect(result.chunks).toHaveLength(2)
    expect(result.chunks[1]).toEqual({
      type: 'tool-input-available',
      toolCallId: 'tc-2',
      toolName: 'set_fill',
      input: { id: '1:2', color: '#ff0000' },
      providerExecuted: true,
      title: 'set_fill'
    })
  })

  test('tool_call with empty title falls back to "unknown"', () => {
    const update: SessionUpdate = {
      sessionUpdate: 'tool_call',
      toolCallId: 'tc-3',
      title: '',
      kind: 'other',
      status: 'pending'
    }
    const result = mapUpdate(update, TEXT_ID, false)
    expect(result.chunks[0]).toMatchObject({ toolName: 'unknown' })
  })

  test('tool_call_update completed emits tool-output-available', () => {
    const update: SessionUpdate = {
      sessionUpdate: 'tool_call_update',
      toolCallId: 'tc-1',
      status: 'completed',
      rawOutput: { id: '1:5', type: 'RECTANGLE' }
    }
    const result = mapUpdate(update, TEXT_ID, false)
    expect(result.chunks).toEqual([
      {
        type: 'tool-output-available',
        toolCallId: 'tc-1',
        output: { id: '1:5', type: 'RECTANGLE' },
        providerExecuted: true
      }
    ])
  })

  test('tool_call_update failed emits tool-output-error', () => {
    const update: SessionUpdate = {
      sessionUpdate: 'tool_call_update',
      toolCallId: 'tc-1',
      status: 'failed',
      content: [{ type: 'content', content: { type: 'text', text: 'Node not found' } }]
    }
    const result = mapUpdate(update, TEXT_ID, false)
    expect(result.chunks).toEqual([
      {
        type: 'tool-output-error',
        toolCallId: 'tc-1',
        errorText: 'Node not found',
        providerExecuted: true
      }
    ])
  })

  test('agent_message_chunk with non-text content produces no chunks', () => {
    const update: SessionUpdate = {
      sessionUpdate: 'agent_message_chunk',
      content: { type: 'image', url: 'https://example.com/img.png' }
    }
    const result = mapUpdate(update, TEXT_ID, false)
    expect(result.textStarted).toBe(false)
    expect(result.chunks).toEqual([])
  })

  test('unhandled update type produces no chunks', () => {
    const update = {
      sessionUpdate: 'available_commands_update',
      availableCommands: []
    } as SessionUpdate
    const result = mapUpdate(update, TEXT_ID, false)
    expect(result.chunks).toEqual([])
    expect(result.textStarted).toBe(false)
  })
})

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
