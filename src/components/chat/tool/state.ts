import { getToolName } from 'ai'

import type { ToolCallPart } from '@/app/ai/chat/tool-calls/display'
import { hasErrorOutput } from '@/app/ai/chat/tool-calls/result'

export type ToolDisplayState = 'pending' | 'done' | 'error'

export type ToolStateInput = {
  toolName: string
  state: string
  output?: unknown
}

export function isMCPToolName(toolName: string): boolean {
  return toolName.startsWith('mcp__') || toolName.startsWith('mcp.')
}

export function classifyToolState({ state, output }: ToolStateInput): ToolDisplayState {
  if (state === 'output-error' || (state === 'output-available' && hasErrorOutput(output))) {
    return 'error'
  }

  if (state === 'output-available') return 'done'
  return 'pending'
}

/** A chat tool call's display state. */
export function toolCallState(part: ToolCallPart): ToolDisplayState {
  return classifyToolState({ toolName: getToolName(part), state: part.state, output: part.output })
}
