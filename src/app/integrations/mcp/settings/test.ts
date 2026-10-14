import { tryOnScopeDispose } from '@vueuse/core'
import { ref, watch, type Ref } from 'vue'

import { connectMCP } from '../client'
import { parseMCPEnvironment } from '../configuration'
import { mcpConnectionSettings } from '../store'
import type { MCPConnectionDraft } from '../types'

export function useMCPConnectionTest(
  draft: Ref<MCPConnectionDraft>,
  token: Ref<string>,
  environment: Ref<string>,
  error: Ref<string>
) {
  const testedTools = ref<string[] | null>(null)
  const testing = ref(false)
  let operation: AbortController | undefined
  function reset() {
    operation?.abort()
    operation = undefined
    testedTools.value = null
    testing.value = false
  }
  watch([draft, token, environment], reset, { deep: true })
  tryOnScopeDispose(reset)
  async function testConnection() {
    reset()
    const controller = new AbortController()
    operation = controller
    testing.value = true
    error.value = ''
    let session: Awaited<ReturnType<typeof connectMCP>> | undefined
    try {
      const value = draft.value
      const id = value.id ?? `mcp-${crypto.randomUUID()}`
      const stored = mcpConnectionSettings.value.connections.find((c) => c.id === id)
      const transport =
        value.transportType === 'stdio'
          ? {
              type: 'stdio' as const,
              command: value.command ?? '',
              args: [...(value.args ?? [])],
              environment:
                stored?.transport.type === 'stdio' ? stored.transport.environment : undefined
            }
          : { type: 'streamable-http' as const, url: value.url }
      session = await connectMCP(
        {
          id,
          name: value.name,
          enabled: false,
          transport,
          authentication:
            value.authenticationType === 'bearer'
              ? (stored?.authentication ?? { type: 'none' })
              : { type: 'none' }
        },
        controller.signal,
        {
          environment: environment.value.trim()
            ? parseMCPEnvironment(environment.value)
            : undefined,
          bearer:
            value.authenticationType === 'bearer' ? token.value.trim() || undefined : undefined
        }
      )
      if (operation === controller) testedTools.value = session.tools.map((tool) => tool.name)
    } catch {
      if (operation === controller)
        error.value =
          'Could not connect to this MCP server. Check its configuration and that it is running.'
    } finally {
      await session?.close()
      if (operation === controller) testing.value = false
    }
  }
  return { testedTools, testing, testConnection }
}
