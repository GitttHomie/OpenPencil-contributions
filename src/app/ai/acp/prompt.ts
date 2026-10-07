import type { UIMessage } from 'ai'

import type { ACPAgentID } from '@open-pencil/core/constants'

import SYSTEM_PROMPT from '@/app/ai/chat/system-prompt'

import { getACPAgentAdapter } from './adapters/registry'
import canvasInstructions from './canvas-instructions.md?raw'

/** Repeat the canvas task boundary so later turns do not revert to CLI coding defaults. */
export function buildACPUserPrompt(
  text: string,
  includeReference: boolean,
  agentId?: ACPAgentID
): string {
  return [
    canvasInstructions.trim(),
    includeReference ? SYSTEM_PROMPT : undefined,
    agentId ? getACPAgentAdapter(agentId).instructions?.trim() : undefined,
    '# Current user request',
    text
  ]
    .filter(Boolean)
    .join('\n\n')
}

const REPLAY_CONTEXT_CHARS = 24_000

export function replayPrompt(
  messages: UIMessage[],
  user: UIMessage | undefined,
  text: string
): string {
  if (!user) return text
  const context = messages
    .slice(0, messages.indexOf(user))
    .map(
      (message) =>
        `${message.role}: ${message.parts
          .filter((part) => part.type === 'text')
          .map((part) => part.text)
          .join('\n')}`
    )
    .join('\n\n')
    .slice(-REPLAY_CONTEXT_CHARS)
  return context ? `Previous conversation:\n${context}\n\nCurrent request:\n${text}` : text
}

export function isReplayRequest(
  trigger: string,
  current?: UIMessage,
  previous?: UIMessage
): boolean {
  return (
    trigger === 'regenerate-message' ||
    (current !== undefined &&
      current.id === previous?.id &&
      JSON.stringify(current.parts) !== JSON.stringify(previous.parts))
  )
}
