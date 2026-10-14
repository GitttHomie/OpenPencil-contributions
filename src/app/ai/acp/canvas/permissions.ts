import type { RequestPermissionRequest, SessionUpdate } from '@agentclientprotocol/sdk'

import { ALL_TOOLS, isToolExposed } from '@open-pencil/core/tools'

import { hasCanvasApproval, rememberCanvasApproval } from './approvals'

const canvasTools = new Set(
  ALL_TOOLS.filter((tool) => isToolExposed(tool, 'mcp')).map((tool) => tool.name)
)
export type CanvasToolIdentifier = (
  update: Extract<SessionUpdate, { sessionUpdate: 'tool_call' }>
) => string | undefined

export function createCanvasPermissionScope(identifyTool?: CanvasToolIdentifier, agent?: string) {
  const calls = new Map<string, { title: string; sessionId: string; name: string }>()
  function verifiedTool(request: RequestPermissionRequest) {
    const call = calls.get(request.toolCall.toolCallId)
    return call && call.title === request.toolCall.title && call.sessionId === request.sessionId
      ? call.name
      : undefined
  }
  return {
    trusted: false,
    observe(update: SessionUpdate, sessionId: string) {
      if (!identifyTool || update.sessionUpdate !== 'tool_call') return
      calls.delete(update.toolCallId)
      const name = identifyTool(update)
      if (!name || !canvasTools.has(name)) return
      calls.set(update.toolCallId, { title: update.title, sessionId, name })
    },
    canApprove(request: RequestPermissionRequest) {
      return verifiedTool(request) !== undefined
    },
    isRemembered(request: RequestPermissionRequest) {
      const name = verifiedTool(request)
      return Boolean(agent && name && hasCanvasApproval(agent, name))
    },
    remember(request: RequestPermissionRequest) {
      const name = verifiedTool(request)
      if (agent && name) rememberCanvasApproval(agent, name)
    }
  }
}

export type CanvasPermissionScope = ReturnType<typeof createCanvasPermissionScope>
