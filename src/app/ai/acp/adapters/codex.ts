import * as v from 'valibot'

import { scopeMCPServers } from './mcp-scope'
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
  isolateMcpOnLaunch: true,
  createSession(options) {
    return {
      ...standardACPAdapter('codex').createSession(options),
      ...scopeMCPServers(options.mcpServers)
    }
  },
  prepareLaunch({ args, env }) {
    if (!args.length) return { args, env }
    // codex-acp 2.x reads CODEX_CONFIG; unlike codex itself, it ignores -c.
    const entries: [string, string][] = []
    for (let index = 0; index < args.length; index += 2) {
      const setting = args[index + 1]
      const separator = setting.indexOf('=')
      const value = v.parse(
        v.pipe(v.string(), v.parseJson(), v.string()),
        setting.slice(separator + 1)
      )
      entries.push([setting.slice(0, separator), value])
    }
    const config = Object.fromEntries(entries)
    return {
      args: [],
      env: {
        ...env,
        CODEX_CONFIG: JSON.stringify(config),
        // The adapter gives MODEL_PROVIDER precedence over CODEX_CONFIG.
        ...(config.model_provider ? { MODEL_PROVIDER: config.model_provider } : {})
      }
    }
  },
  createTurn
}
