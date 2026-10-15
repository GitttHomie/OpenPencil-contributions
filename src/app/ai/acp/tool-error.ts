import * as v from 'valibot'

import { scrubDiagnosticText } from '@/app/diagnostics/scrub'

const MAX_ERROR_LENGTH = 4000
const MAX_JSON_LENGTH = 32_768
const JSONValue = v.pipe(v.string(), v.parseJson(), v.unknown())
type ErrorEnvelope = {
  type?: unknown
  error?: unknown
  message?: unknown
  result?: unknown
  content?: unknown
  text?: unknown
}

/** Read known error envelopes without dumping arbitrary tool payloads or encoded images. */
function errorMessage(value: unknown, depth = 0): string | undefined {
  if (depth > 6 || value == null) return undefined
  if (typeof value === 'string') {
    const text = value.trim()
    if (!text) return undefined
    if (text.startsWith('{') || text.startsWith('[')) {
      if (text.length > MAX_JSON_LENGTH) return undefined
      const parsed = v.safeParse(JSONValue, text)
      return parsed.success ? errorMessage(parsed.output, depth + 1) : undefined
    }
    return text.slice(0, MAX_ERROR_LENGTH)
  }
  if (Array.isArray(value)) {
    return (
      value
        .slice(0, 8)
        .map((item) => errorMessage(item, depth + 1))
        .filter(Boolean)
        .join('\n') || undefined
    )
  }
  if (typeof value !== 'object') return undefined
  const entry = value as ErrorEnvelope
  if (entry.type === 'image' || entry.type === 'audio' || entry.type === 'resource')
    return undefined
  for (const key of ['error', 'message', 'result', 'content', 'text'] as const) {
    const message = errorMessage(entry[key], depth + 1)
    if (message) return message
  }
  return undefined
}

export function acpToolError(content: unknown, rawOutput: unknown): string {
  const message = errorMessage(content) ?? errorMessage(rawOutput) ?? 'Tool call failed'
  return scrubDiagnosticText(message).slice(0, MAX_ERROR_LENGTH)
}
