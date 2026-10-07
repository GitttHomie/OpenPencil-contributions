import type { Client, McpServer, PromptResponse, SessionUpdate } from '@agentclientprotocol/sdk'

import type { ACPAgentID } from '@open-pencil/core/constants'
import type { useAIMessages } from '@open-pencil/vue'

import type { CanvasPermissionScope } from '../canvas/permissions'

type AIMessages = ReturnType<typeof useAIMessages>['value']
type AITextKey = {
  [Key in keyof AIMessages]: AIMessages[Key] extends string ? Key : never
}[keyof AIMessages]

export type ACPToolPresentation = {
  label: AITextKey
  description?: AITextKey
}

export type ACPAdapterSession = {
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
  instructions?: string
  toolPresentation?: Readonly<Record<string, ACPToolPresentation>>
  createTurn?: () => ACPAdapterTurn
  createSession(options: {
    purpose: 'design' | 'review' | 'catalog' | 'verification'
    mcpServers: readonly McpServer[]
  }): ACPAdapterSession
}
