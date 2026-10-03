import type { SessionUpdate } from '@agentclientprotocol/sdk'
import type { UIMessageChunk } from 'ai'

import { mapUpdate, type ACPToolState } from './map-update'

export function createACPUpdateStream(textId: string) {
  let textStarted = false
  let reasoningId: string | null = null
  let reasoningIndex = 0
  const tools = new Map<string, ACPToolState>()

  function endReasoning(): UIMessageChunk[] {
    if (!reasoningId) return []
    const id = reasoningId
    reasoningId = null
    return [{ type: 'reasoning-end', id }]
  }

  function map(update: SessionUpdate): UIMessageChunk[] {
    const chunks: UIMessageChunk[] = []
    if (update.sessionUpdate === 'agent_thought_chunk') {
      if (update.content.type !== 'text' || !update.content.text) return chunks
      if (!reasoningId) {
        reasoningId = `reasoning-${textId}-${reasoningIndex++}`
        chunks.push({ type: 'reasoning-start', id: reasoningId })
      }
      chunks.push({ type: 'reasoning-delta', id: reasoningId, delta: update.content.text })
      return chunks
    }
    if (
      update.sessionUpdate === 'tool_call' ||
      update.sessionUpdate === 'tool_call_update' ||
      (update.sessionUpdate === 'agent_message_chunk' &&
        update.content.type === 'text' &&
        update.content.text)
    ) {
      chunks.push(...endReasoning())
    }
    const result = mapUpdate(update, textId, textStarted, tools)
    textStarted = result.textStarted
    return [...chunks, ...result.chunks]
  }

  function finish(): UIMessageChunk[] {
    const chunks = endReasoning()
    if (textStarted) {
      chunks.push({ type: 'text-end', id: textId })
      textStarted = false
    }
    return chunks
  }

  return { map, finish }
}
