import type { McpServer, SessionUpdate } from '@agentclientprotocol/sdk'
import * as v from 'valibot'

const serverInput = v.looseObject({ server: v.string() })

/** Fresh names prevent a CLI from merging global commands, headers, or env into our servers. */
export function scopeMCPServers(servers: readonly McpServer[]) {
  const suffix = crypto.randomUUID().replaceAll('-', '')
  const names = new Map(servers.map(({ name }, index) => [`op-${suffix}-${index}`, name]))
  const mcpServers = servers.map((server, index) => ({
    ...server,
    name: `op-${suffix}-${index}`
  }))
  function normalizeUpdate(update: SessionUpdate): SessionUpdate {
    if (update.sessionUpdate !== 'tool_call' && update.sessionUpdate !== 'tool_call_update') {
      return update
    }
    let title = update.title
    for (const [runtime, original] of names) {
      for (const [before, after] of [
        [`${runtime} · `, `${original} · `],
        [`mcp__${runtime}__`, `mcp__${original}__`],
        [`mcp.${runtime}.`, `mcp.${original}.`]
      ]) {
        if (title?.startsWith(before)) title = after + title.slice(before.length)
      }
    }
    const input = v.safeParse(serverInput, update.rawInput)
    const original = input.success ? names.get(input.output.server) : undefined
    const normalized = { ...update }
    if (typeof title === 'string') normalized.title = title
    if (input.success && original) normalized.rawInput = { ...input.output, server: original }
    return normalized
  }
  return {
    mcpServers,
    normalizeUpdate,
    promptContext: servers.length
      ? `Session MCP routing: server names in general guidance are logical names. For tool calls in this session, use these exact runtime server names instead: ${JSON.stringify(
          Object.fromEntries([...names].map(([runtime, logical]) => [logical, runtime]))
        )}. Do not use a different server as a substitute.`
      : undefined
  }
}
