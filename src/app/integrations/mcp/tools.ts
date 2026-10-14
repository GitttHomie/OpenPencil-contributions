import { useEventListener } from '@vueuse/core'
import { jsonSchema, tool, type ToolSet, type JSONSchema7 } from 'ai'

import { createCanvasPermissionScope } from '@/app/ai/acp/canvas/permissions'
import { cancelPermissionsForScope, requestPermissionFromUser } from '@/app/ai/acp/permission'

import { connectMCP } from './client'
import { selectedMCPConnections } from './selection'

/** One client per selected server, owned and closed by the chat transport. */
export async function createExternalMCPTools(
  ids: readonly string[],
  connect = connectMCP,
  log?: (type: string, data: unknown) => void
) {
  const sessions: Awaited<ReturnType<typeof connectMCP>>[] = []
  const scopes: ReturnType<typeof createCanvasPermissionScope>[] = []
  const tools: ToolSet = {}
  async function close() {
    for (const scope of scopes) cancelPermissionsForScope(scope)
    await Promise.allSettled(sessions.map((session) => session.close()))
  }
  try {
    for (const connection of selectedMCPConnections(ids)) {
      const session = await connect(connection)
      sessions.push(session)
      for (const definition of session.tools) {
        // Catalog order can change; conversation history must keep the same tool identity.
        const digest = await crypto.subtle.digest(
          'SHA-256',
          new TextEncoder().encode(`${connection.id}/${definition.name}`)
        )
        const id = `mcp_${Array.from(new Uint8Array(digest))
          .map((byte) => byte.toString(16).padStart(2, '0'))
          .join('')
          .slice(0, 48)}`
        const title = `${connection.name} · ${definition.title || definition.name}`
        tools[id] = tool({
          title,
          description: `${title}\n${definition.description ?? ''}`,
          inputSchema: jsonSchema<Record<string, unknown>>(definition.inputSchema as JSONSchema7),
          execute: async (args, options) => {
            const scope = createCanvasPermissionScope()
            scopes.push(scope)
            const stop = options.abortSignal
              ? useEventListener(options.abortSignal, 'abort', () =>
                  cancelPermissionsForScope(scope)
                )
              : () => undefined
            try {
              options.abortSignal?.throwIfAborted()
              if (!connection.autoApprove?.includes(definition.name)) {
                log?.('permission.request', { toolCallId: options.toolCallId, tool: title })
                const decision = await requestPermissionFromUser(
                  {
                    sessionId: connection.id,
                    toolCall: { toolCallId: options.toolCallId, title, rawInput: args },
                    options: [
                      { optionId: 'allow', name: 'Allow once', kind: 'allow_once' },
                      { optionId: 'deny', name: 'Decline', kind: 'reject_once' }
                    ]
                  },
                  scope
                )
                log?.('permission.response', { toolCallId: options.toolCallId, ...decision })
                if (
                  decision.outcome.outcome !== 'selected' ||
                  decision.outcome.optionId !== 'allow'
                ) {
                  throw new Error('Tool execution was not approved.')
                }
              }
              options.abortSignal?.throwIfAborted()
              return await session.client.callTool(
                { name: definition.name, arguments: args },
                { signal: options.abortSignal, timeout: 180_000 }
              )
            } finally {
              stop()
              cancelPermissionsForScope(scope)
              const index = scopes.indexOf(scope)
              if (index !== -1) scopes.splice(index, 1)
            }
          },
          toModelOutput: ({ output }) => ({
            type: 'content',
            value: output.content.map((item) => {
              if (item.type === 'image') {
                return {
                  type: 'file' as const,
                  mediaType: item.mimeType,
                  data: { type: 'data' as const, data: item.data }
                }
              }
              return {
                type: 'text' as const,
                text: item.type === 'text' ? item.text : JSON.stringify(item)
              }
            })
          })
        })
      }
    }
    return { tools, close }
  } catch (error) {
    await close()
    throw error
  }
}
