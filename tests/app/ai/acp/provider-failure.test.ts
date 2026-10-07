import { expect, test } from 'bun:test'

import { AgentSideConnection, ndJsonStream, PROTOCOL_VERSION } from '@agentclientprotocol/sdk'
import type { UIMessageChunk } from 'ai'

import { ACP_AGENTS } from '@open-pencil/core/constants'

import { ACPChatTransport } from '@/app/ai/acp/transport'
import { classifyAIChatError } from '@/app/ai/chat/failure'

test('a Codex HTTP error reported as assistant text reaches chat recovery and finishes as failed', async () => {
  const definition = ACP_AGENTS.find((agent) => agent.id === 'codex')
  if (!definition) throw new Error('Codex definition missing')
  const message =
    "unexpected status 404 Not Found: The model 'example-model' does not exist, " +
    'url: https://provider.example/v1/responses, request id: example-request'
  let receiveAgent: ReadableStreamDefaultController<Uint8Array> | undefined
  let receiveClient: ReadableStreamDefaultController<Uint8Array> | undefined
  const agentInput = new ReadableStream<Uint8Array>({
    start(controller) {
      receiveAgent = controller
    }
  })
  const clientOutput = new ReadableStream<Uint8Array>({
    start(controller) {
      receiveClient = controller
    }
  })
  const agentOutput = new WritableStream<Uint8Array>({
    write: (chunk) => receiveClient?.enqueue(chunk)
  })
  const clientInput = new WritableStream<Uint8Array>({
    write: (chunk) => receiveAgent?.enqueue(chunk)
  })
  const connection = new AgentSideConnection(
    (client) => ({
      initialize: async () => ({ protocolVersion: PROTOCOL_VERSION }),
      newSession: async () => ({ sessionId: 'failure-session' }),
      authenticate: async () => ({}),
      cancel: async () => undefined,
      prompt: async ({ sessionId }) => {
        await client.sessionUpdate({
          sessionId,
          update: {
            sessionUpdate: 'agent_message_chunk',
            content: { type: 'text', text: message }
          }
        })
        return { stopReason: 'end_turn' }
      }
    }),
    ndJsonStream(agentOutput, agentInput)
  )
  const transport = new ACPChatTransport(
    { agentDef: definition, purpose: 'review' },
    {
      mcpServers: async () => [],
      spawn: async () => ({
        input: clientInput,
        output: clientOutput,
        child: {
          write: async () => undefined,
          kill: async () => {
            receiveAgent?.close()
            receiveClient?.close()
          }
        }
      })
    }
  )
  try {
    const stream = await transport.sendMessages({
      chatId: 'failure-chat',
      trigger: 'submit-message',
      messages: [{ id: 'question', role: 'user', parts: [{ type: 'text', text: 'Hello' }] }]
    })
    const chunks: UIMessageChunk[] = []
    for await (const chunk of stream) chunks.push(chunk)
    expect(chunks).toContainEqual({ type: 'error', errorText: message })
    expect(chunks.at(-1)).toEqual({ type: 'finish', finishReason: 'error' })
    expect(classifyAIChatError(new Error(message)).reason).toBe('model-not-found')
  } finally {
    await transport.destroy()
    await connection.closed
  }
})
