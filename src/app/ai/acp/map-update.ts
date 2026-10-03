import type { SessionUpdate } from '@agentclientprotocol/sdk'
import type { UIMessageChunk } from 'ai'

import type { JSONObject } from '@open-pencil/scene-graph/primitives'

export interface MapResult {
  chunks: UIMessageChunk[]
  textStarted: boolean
}

export interface ACPToolState {
  name: string
  title?: string
  inputAvailable: boolean
}

export function mapUpdate(
  update: SessionUpdate,
  textId: string,
  textStarted: boolean,
  tools = new Map<string, ACPToolState>()
): MapResult {
  const chunks: UIMessageChunk[] = []

  switch (update.sessionUpdate) {
    case 'agent_message_chunk': {
      if (update.content.type === 'text' && update.content.text) {
        if (!textStarted) {
          chunks.push({ type: 'text-start', id: textId })
          textStarted = true
        }
        chunks.push({
          type: 'text-delta',
          id: textId,
          delta: update.content.text
        })
      } else if (update.content.type !== 'text') {
        console.warn('[ACP] Unhandled content type:', update.content.type)
      }
      break
    }
    case 'tool_call':
    case 'tool_call_update':
      chunks.push(...mapToolUpdate(update, tools))
      break
  }

  return { chunks, textStarted }
}

function mapToolUpdate(
  update: Extract<SessionUpdate, { sessionUpdate: 'tool_call' | 'tool_call_update' }>,
  tools: Map<string, ACPToolState>
): UIMessageChunk[] {
  const chunks: UIMessageChunk[] = []
  let tool = tools.get(update.toolCallId)
  if (!tool) {
    tool = {
      name: update.title || 'unknown',
      title: update.title ?? undefined,
      inputAvailable: false
    }
    tools.set(update.toolCallId, tool)
    chunks.push({
      type: 'tool-input-start',
      toolCallId: update.toolCallId,
      toolName: tool.name,
      providerExecuted: true,
      title: tool.title
    })
  }
  const terminal = update.status === 'completed' || update.status === 'failed'
  if (update.rawInput !== undefined || (terminal && !tool.inputAvailable)) {
    chunks.push({
      type: 'tool-input-available',
      toolCallId: update.toolCallId,
      toolName: tool.name,
      input: update.rawInput ?? {},
      providerExecuted: true,
      title: update.title ?? tool.title
    })
    tool.inputAvailable = true
  }
  if (update.status === 'completed') {
    chunks.push({
      type: 'tool-output-available',
      toolCallId: update.toolCallId,
      output: update.rawOutput ?? textFromContent(update.content ?? undefined),
      providerExecuted: true
    })
  } else if (update.status === 'failed') {
    chunks.push({
      type: 'tool-output-error',
      toolCallId: update.toolCallId,
      errorText: textFromContent(update.content ?? undefined) ?? 'Tool call failed',
      providerExecuted: true
    })
  }
  return chunks
}

export function textFromContent(content: JSONObject[] | undefined): string | undefined {
  if (!content) return undefined
  const parts: string[] = []
  for (const c of content) {
    if (c.type !== 'content') continue
    const inner = c.content as JSONObject | undefined
    if (inner?.type === 'text' && typeof inner.text === 'string') {
      parts.push(inner.text)
    }
  }
  return parts.length > 0 ? parts.join('\n') : undefined
}
