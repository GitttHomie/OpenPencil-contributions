import { expect, test } from 'bun:test'

import type { PromptResponse } from '@agentclientprotocol/sdk'

import { codexAdapter } from '@/app/ai/acp/adapters/codex'

const message =
  "unexpected status 404 Not Found: The model 'example-model' does not exist, " +
  'url: https://provider.example/v1/responses, request id: example-request'
const ended: PromptResponse = { stopReason: 'end_turn' }

function turnWithText(text: string) {
  const turn = codexAdapter.createTurn?.()
  if (!turn) throw new Error('Codex turn observer missing')
  for (const part of [text.slice(0, 20), text.slice(20)]) {
    turn.observe({
      sessionUpdate: 'agent_message_chunk',
      content: { type: 'text', text: part }
    })
  }
  return turn
}

test('Codex HTTP failures split across text chunks fail an otherwise successful turn', () => {
  expect(turnWithText(message).failure(ended)).toBe(message)
  expect(turnWithText('Done').failure(ended)).toBeUndefined()
})

test('quoted errors, long replies, and cancelled turns remain ordinary responses', () => {
  expect(turnWithText(`The error was: ${message}`).failure(ended)).toBeUndefined()
  expect(turnWithText(`${message}${' '.repeat(4096)}`).failure(ended)).toBeUndefined()
  expect(turnWithText(message).failure({ stopReason: 'cancelled' })).toBeUndefined()
})

test('a model-generated explanation or tool workflow is not reclassified as a provider failure', () => {
  expect(
    turnWithText(message).failure({
      ...ended,
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 }
    })
  ).toBeUndefined()
  const turn = turnWithText(message)
  turn.observe({
    sessionUpdate: 'tool_call',
    toolCallId: 'read',
    title: 'Read',
    status: 'completed'
  })
  expect(turn.failure(ended)).toBeUndefined()
})
