import { ALL_TOOLS, isToolExposed, toolChangesDocument } from '@open-pencil/core/tools'

import type { ToolAccessEntry } from '@/app/automation/tool-access/types'

export const aiToolDefinitions = ALL_TOOLS.filter((tool) => isToolExposed(tool, 'ai'))
const availableNames = new Set(aiToolDefinitions.map((tool) => tool.name))

export const configurableAITools: ToolAccessEntry[] = aiToolDefinitions.map((tool) => ({
  name: tool.name,
  description: tool.description,
  effect: toolChangesDocument(tool) ? 'write' : 'read'
}))

export function isAIToolEnabled(name: string, overrides: Readonly<Record<string, boolean>>) {
  return availableNames.has(name) && (overrides[name] ?? true)
}

export function enabledAIToolDefinitions(overrides: Readonly<Record<string, boolean>>) {
  return aiToolDefinitions.filter((tool) => isAIToolEnabled(tool.name, overrides))
}
