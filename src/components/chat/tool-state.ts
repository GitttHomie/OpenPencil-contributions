export type ToolDisplayState = 'pending' | 'done' | 'error'

export type ToolStateInput = {
  toolName: string
  state: string
  output?: unknown
}

export function isMCPToolName(toolName: string): boolean {
  return toolName.startsWith('mcp__') || toolName.startsWith('mcp.')
}

/** Codex ACP wraps successful MCP results in { result, error: null }. */
export function toolResultOutput(output: unknown): unknown {
  if (
    typeof output === 'object' &&
    output !== null &&
    'result' in output &&
    'error' in output &&
    output.error == null
  )
    return output.result
  return output
}

export function hasErrorOutput(output: unknown): boolean {
  const result = toolResultOutput(output)
  if (typeof result !== 'object' || result === null) return false
  if ('isError' in result && result.isError === true) return true
  return 'error' in result && result.error != null && result.error !== false && result.error !== ''
}

export function classifyToolState({ state, output }: ToolStateInput): ToolDisplayState {
  if (state === 'output-error' || (state === 'output-available' && hasErrorOutput(output))) {
    return 'error'
  }

  if (state === 'output-available') return 'done'
  return 'pending'
}
