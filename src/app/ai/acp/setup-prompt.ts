import dedent from 'dedent'

import { ACP_AGENTS, type ACPAgentID } from '@open-pencil/core/constants'

import { CODING_AGENTS_GUIDE_URL } from '@/constants'

const SIGN_IN: Record<ACPAgentID, string> = {
  'claude-code':
    'Make sure I am signed in to Claude Code: run `claude` and use `/login` if it asks me to sign in.',
  'kiro-cli': 'Make sure I am signed in to Kiro CLI: run `kiro-cli login` if I am not.',
  codex: 'Make sure I am signed in to Codex: run `codex login` if I am not.',
  'gemini-cli': 'Make sure I am signed in to Gemini CLI: run `gemini` and choose a sign-in method.'
}

export function codingAgentGuideURL(agentID: ACPAgentID): string {
  return `${CODING_AGENTS_GUIDE_URL}#${agentID}`
}

/**
 * Markdown to paste into a coding agent the person already uses, asking it to install what
 * OpenPencil needs to start it. Written for the agent, so it stays in English.
 */
export function codingAgentSetupPrompt(agentID: ACPAgentID): string {
  const agent = ACP_AGENTS.find((candidate) => candidate.id === agentID)
  if (!agent) return ''
  const install = agent.installCommand ?? `Install ${agent.name}`
  return dedent`
    Help me connect ${agent.name} to OpenPencil, an open-source design editor. OpenPencil starts ${agent.name} through the Agent Client Protocol. The desktop app includes and manages its own canvas MCP helper and runtime.

    Please do this for me:

    1. If \`${agent.command}\` is not on my PATH, install it: \`${install}\`
    2. Open OpenPencil and check its canvas connection in Settings. Do not install a global MCP helper or a JavaScript runtime for the canvas connection.
    3. Confirm the agent command is found, for example with \`which ${agent.command}\` (\`where\` on Windows). If its global npm folder is missing from my PATH, tell me how to add it.
    4. ${SIGN_IN[agentID]}

    Then tell me what you installed and anything I still need to do myself. I will press "Check again" in OpenPencil's AI setup afterwards.

    Setup guide: ${codingAgentGuideURL(agentID)}
  `
}
