import { expect, test } from 'bun:test'

import type { SessionUpdate } from '@agentclientprotocol/sdk'
import { readUIMessageStream, type UIMessage, type UIMessageChunk } from 'ai'

import { createACPUpdateStream } from '@/app/ai/acp/stream-updates'

function thought(text: string): SessionUpdate {
  return { sessionUpdate: 'agent_thought_chunk', content: { type: 'text', text } }
}

async function messageFrom(updates: SessionUpdate[]) {
  const mapper = createACPUpdateStream('text-test')
  const stream = new ReadableStream<UIMessageChunk>({
    start(controller) {
      controller.enqueue({ type: 'start' })
      controller.enqueue({ type: 'start-step' })
      for (const update of updates) {
        for (const chunk of mapper.map(update)) controller.enqueue(chunk)
      }
      for (const chunk of mapper.finish()) controller.enqueue(chunk)
      controller.enqueue({ type: 'finish-step' })
      controller.enqueue({ type: 'finish', finishReason: 'stop' })
      controller.close()
    }
  })
  let message: UIMessage | undefined
  for await (const next of readUIMessageStream({ stream, terminateOnError: true })) message = next
  if (!message) throw new Error('Missing streamed message')
  return message
}

test('word-sized thought chunks form one completed reasoning part', async () => {
  const message = await messageFrom([
    thought('Checking'),
    thought(' '),
    thought('the layout.'),
    { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'Done' } }
  ])
  expect(message.parts.filter((part) => part.type === 'reasoning')).toMatchObject([
    { text: 'Checking the layout.', state: 'done' }
  ])
})

test('a tool boundary ends reasoning and later thoughts get a separate block', async () => {
  const message = await messageFrom([
    thought('Before.'),
    { sessionUpdate: 'tool_call', toolCallId: 'tool-1', title: 'Inspect', status: 'pending' },
    { sessionUpdate: 'tool_call_update', toolCallId: 'tool-1', status: 'completed', rawOutput: {} },
    thought('After.'),
    thought(' Done.')
  ])
  const parts = message.parts.filter((part) => part.type === 'reasoning')
  expect(parts).toMatchObject([
    { text: 'Before.', state: 'done' },
    { text: 'After. Done.', state: 'done' }
  ])
  expect(parts[0]?.id).not.toBe(parts[1]?.id)
})

test('empty chunks and metadata do not split reasoning', async () => {
  const message = await messageFrom([
    thought('First'),
    thought(''),
    { sessionUpdate: 'current_mode_update', currentModeId: 'code' },
    thought(' second')
  ])
  expect(message.parts.filter((part) => part.type === 'reasoning')).toMatchObject([
    { text: 'First second', state: 'done' }
  ])
})

test('Kiro completion without a start creates a valid finished tool part', async () => {
  const message = await messageFrom([
    {
      sessionUpdate: 'tool_call_update',
      toolCallId: 'load-tools',
      title: 'Tool Load',
      status: 'completed',
      rawInput: { tool_ids: ['open-pencil::get_selection'] },
      rawOutput: { loaded: ['open-pencil::get_selection'] }
    }
  ])
  expect(message.parts.find((part) => 'toolCallId' in part)).toMatchObject({
    toolCallId: 'load-tools',
    state: 'output-available',
    input: { tool_ids: ['open-pencil::get_selection'] },
    output: { loaded: ['open-pencil::get_selection'] }
  })
})

test('input on later updates and terminal status on an initial call are retained', async () => {
  const message = await messageFrom([
    { sessionUpdate: 'tool_call', toolCallId: 'one', title: 'Inspect', status: 'pending' },
    { sessionUpdate: 'tool_call_update', toolCallId: 'one', rawInput: { id: 'frame' } },
    { sessionUpdate: 'tool_call_update', toolCallId: 'one', status: 'completed', rawOutput: {} },
    { sessionUpdate: 'tool_call', toolCallId: 'two', title: 'Another', status: 'failed' }
  ])
  expect(message.parts.filter((part) => 'toolCallId' in part)).toMatchObject([
    { toolCallId: 'one', state: 'output-available', input: { id: 'frame' } },
    { toolCallId: 'two', state: 'output-error' }
  ])
})
