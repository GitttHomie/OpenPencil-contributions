import type { UIMessage } from 'ai'

import { resolveAIModelRole } from '@/app/ai/models'

import SYSTEM_PROMPT from '../system-prompt'
import { chatThinkingLevel } from '../thinking'
import type { SessionLog } from './types'

export function sessionLogRequest(
  messages: UIMessage[],
  trigger: string,
  connectionIds: readonly string[] = []
) {
  const selected = resolveAIModelRole('design')
  return {
    messages,
    trigger,
    provider: selected?.connection.providerID,
    profile: selected?.profile.name,
    model: selected?.profile.customModelID || selected?.profile.modelID,
    thinking: chatThinkingLevel.value,
    connections: [...connectionIds],
    appInstructions: SYSTEM_PROMPT
  }
}

export function sessionLogStatus(event: {
  isError: boolean
  isAbort: boolean
  isDisconnect: boolean
}): SessionLog['status'] {
  if (event.isError) return 'failed'
  if (event.isAbort) return 'stopped'
  return event.isDisconnect ? 'disconnected' : 'completed'
}
