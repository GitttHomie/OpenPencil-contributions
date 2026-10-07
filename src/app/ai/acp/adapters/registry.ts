import type { ACPAgentID } from '@open-pencil/core/constants'

import { claudeAdapter } from './claude'
import { codexAdapter } from './codex'
import { kiroAdapter } from './kiro'
import { standardACPAdapter } from './standard'
import type { ACPAgentAdapter, ACPToolPresentation } from './types'

const adapters: Record<ACPAgentID, ACPAgentAdapter> = {
  'claude-code': claudeAdapter,
  codex: codexAdapter,
  'gemini-cli': standardACPAdapter('gemini-cli'),
  'kiro-cli': kiroAdapter
}

export function getACPAgentAdapter(id: ACPAgentID): ACPAgentAdapter {
  return adapters[id]
}

/** Historical tool cards retain their labels even after the active profile changes. */
export function acpToolPresentation(name: string): ACPToolPresentation | undefined {
  const normalized = name.toLowerCase().replace(/\s+/g, '_')
  for (const adapter of Object.values(adapters)) {
    const labels = adapter.toolPresentation
    if (labels && Object.hasOwn(labels, normalized)) return labels[normalized]
  }
  return undefined
}
