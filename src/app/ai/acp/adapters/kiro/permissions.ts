import * as v from 'valibot'

import type { CanvasToolIdentifier } from '@/app/ai/acp/canvas/permissions'

const originSchema = v.object({
  kiro: v.object({ serverName: v.literal('open-pencil') })
})
const inputSchema = v.object({ tool_id: v.string() })
const TOOL_PREFIX = 'open-pencil::'

export const kiroCanvasToolName: CanvasToolIdentifier = (update) => {
  const origin = v.safeParse(originSchema, update._meta)
  const input = v.safeParse(inputSchema, update.rawInput)
  if (!origin.success || !input.success) return undefined
  const id = input.output.tool_id
  if (!id.startsWith(TOOL_PREFIX)) return undefined
  const name = id.slice(TOOL_PREFIX.length)
  return update.title === `@open-pencil/${name}` ? name : undefined
}
