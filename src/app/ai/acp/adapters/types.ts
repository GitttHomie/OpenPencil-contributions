import type {
  Client,
  McpServer,
  NewSessionRequest,
  PromptResponse,
  SessionUpdate,
  ToolCall
} from '@agentclientprotocol/sdk'

import type { ACPAgentID } from '@open-pencil/core/constants'
import type { useAIMessages } from '@open-pencil/vue'

import type { CanvasPermissionScope } from '../canvas/permissions'
import type { resolveIntegration } from '../configuration/resolve'

type AIMessages = ReturnType<typeof useAIMessages>['value']
type AITextKey = {
  [Key in keyof AIMessages]: AIMessages[Key] extends string ? Key : never
}[keyof AIMessages]

export type ACPToolPresentation = {
  label: AITextKey
  description?: AITextKey
}

export type ACPAdapterSession = {
  meta?: NewSessionRequest['_meta']
  mcpServers?: McpServer[]
  promptContext?: string
  normalizeUpdate?: (update: SessionUpdate) => SessionUpdate
  permissions: CanvasPermissionScope
  notification?: NonNullable<Client['extNotification']>
  ready?: (sessionId: string, signal: AbortSignal) => Promise<void>
}

export type ACPAdapterTurn = {
  observe(update: SessionUpdate): void
  failure(response: PromptResponse): string | undefined
}

export type ACPAgentAdapter = {
  id: ACPAgentID
  /** The native launcher filters inherited MCP configuration for this adapter. */
  isolateMcpOnLaunch?: boolean
  instructions?: string
  toolPresentation?: Readonly<Record<string, ACPToolPresentation>>
  /** CLI housekeeping reported as a tool event, rather than a model-requested operation. */
  isSetupTool?: (tool: ToolCall) => boolean
  createTurn?: () => ACPAdapterTurn
  prepareLaunch?: (
    options: ReturnType<typeof resolveIntegration>
  ) => ReturnType<typeof resolveIntegration>
  createSession(options: {
    purpose: 'design' | 'review' | 'vision' | 'catalog' | 'verification'
    mcpServers: readonly McpServer[]
  }): ACPAdapterSession
}
