import { standardACPAdapter } from './standard'
import type { ACPAgentAdapter } from './types'

const standard = standardACPAdapter('claude-code')

export const claudeAdapter: ACPAgentAdapter = {
  ...standard,
  createSession(options) {
    return {
      ...standard.createSession(options),
      meta: { claudeCode: { options: { strictMcpConfig: true } } }
    }
  }
}
