import type { RequestPermissionRequest, SessionUpdate } from '@agentclientprotocol/sdk'

import { ALL_TOOLS, isToolExposed } from '@open-pencil/core/tools'

const canvasTools = new Set(
  ALL_TOOLS.filter((tool) => isToolExposed(tool, 'mcp')).map((tool) => tool.name)
)
export type CanvasToolIdentifier = (
  update: Extract<SessionUpdate, { sessionUpdate: 'tool_call' }>
) => string | undefined

export function createCanvasPermissionScope(identifyTool?: CanvasToolIdentifier) {
  const calls = new Map<string, { title: string; sessionId: string }>()
  return {
    trusted: false,
    observe(update: SessionUpdate, sessionId: string) {
      if (!identifyTool || update.sessionUpdate !== 'tool_call') return
      calls.delete(update.toolCallId)
      const name = identifyTool(update)
      if (!name || !canvasTools.has(name)) return
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
