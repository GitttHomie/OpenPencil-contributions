import type { RequestPermissionRequest, SessionUpdate } from '@agentclientprotocol/sdk'
import * as v from 'valibot'

import { ALL_TOOLS, isToolExposed } from '@open-pencil/core/tools'

const canvasTools = new Set(
  ALL_TOOLS.filter((tool) => isToolExposed(tool, 'mcp')).map((tool) => tool.name)
)
const originSchema = v.object({
  kiro: v.object({ serverName: v.literal('open-pencil') })
})
const inputSchema = v.object({ tool_id: v.string() })
const TOOL_PREFIX = 'open-pencil::'

export function createCanvasPermissionScope(enabled: boolean) {
  const calls = new Map<string, { title: string; sessionId: string }>()
  return {
    trusted: false,
    observe(update: SessionUpdate, sessionId: string) {
      if (!enabled || update.sessionUpdate !== 'tool_call') return
      calls.delete(update.toolCallId)
      const origin = v.safeParse(originSchema, update._meta)
      const input = v.safeParse(inputSchema, update.rawInput)
      if (!origin.success || !input.success) return
      const id = input.output.tool_id
      if (!id.startsWith(TOOL_PREFIX)) return
      const name = id.slice(TOOL_PREFIX.length)
      if (!canvasTools.has(name) || update.title !== `@open-pencil/${name}`) return
      calls.set(update.toolCallId, { title: update.title, sessionId })
    },
    canApprove(request: RequestPermissionRequest) {
      const call = calls.get(request.toolCall.toolCallId)
      return Boolean(
        call && call.title === request.toolCall.title && call.sessionId === request.sessionId
      )
    }
  }
}

export type CanvasPermissionScope = ReturnType<typeof createCanvasPermissionScope>
