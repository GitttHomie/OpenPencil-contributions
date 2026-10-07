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

/** Inspect the structured payload of successful MCP results without interpreting prose. */
export function toolResultData(output: unknown): unknown {
  const result = toolResultOutput(output)
  if (typeof result !== 'object' || result === null || hasErrorOutput(result)) return result
  if ('structuredContent' in result && result.structuredContent != null)
    return result.structuredContent
  if (!('content' in result) || !Array.isArray(result.content) || result.content.length !== 1)
    return result
  const item: unknown = result.content[0]
  if (
    typeof item !== 'object' ||
    item === null ||
    !('type' in item) ||
    item.type !== 'text' ||
    !('text' in item) ||
    typeof item.text !== 'string'
  )
    return result
  try {
    const parsed: unknown = JSON.parse(item.text)
    return parsed
  } catch {
    return result
  }
}
