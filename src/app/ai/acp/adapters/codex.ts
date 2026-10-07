import { standardACPAdapter } from './standard'
import type { ACPAdapterTurn, ACPAgentAdapter } from './types'

const MAX_FAILURE_TEXT = 4096

/** Codex ACP can return a transport error as assistant text followed by end_turn. */
function createTurn(): ACPAdapterTurn {
  let text = ''
  let usedTools = false
  let overflow = false
  return {
    observe(update) {
      if (update.sessionUpdate === 'tool_call') usedTools = true
      if (update.sessionUpdate !== 'agent_message_chunk' || update.content.type !== 'text') return
      overflow ||= text.length + update.content.text.length > MAX_FAILURE_TEXT
      text = (text + update.content.text).slice(0, MAX_FAILURE_TEXT)
    },
    failure(response) {
      if (
        response.stopReason !== 'end_turn' ||
        usedTools ||
        overflow ||
        (response.usage?.outputTokens ?? 0) > 0
      ) {
        return undefined
      }
      const message = text.trim()
      // Match the CLI's complete machine-generated HTTP error, not quoted errors
      // or an agent explaining an unsuccessful tool call.
      return /^unexpected status [45]\d{2}\b[\s\S]*,\s*url: https?:\/\/\S+,\s*request id: \S+$/.test(
        message
      )
        ? message
        : undefined
    }
  }
}

export const codexAdapter: ACPAgentAdapter = {
  ...standardACPAdapter('codex'),
  createTurn
}
