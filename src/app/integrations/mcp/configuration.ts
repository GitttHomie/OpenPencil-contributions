import * as v from 'valibot'

import type { MCPConnectionDraft } from './types'

const argument = v.pipe(
  v.string(),
  v.maxLength(8192),
  v.check((s) => !s.includes('\0'))
)
export const environmentSchema = v.record(
  v.pipe(v.string(), v.regex(/^[A-Za-z_][A-Za-z0-9_]*$/)),
  argument
)
export const localTransportSchema = v.object({
  type: v.literal('stdio'),
  command: v.pipe(argument, v.trim(), v.minLength(1)),
  args: v.pipe(v.array(argument), v.maxLength(128)),
  environment: v.optional(
    v.object({ integrationId: v.string(), profileId: v.string(), field: v.string() })
  )
})
const importedServer = v.object({
  command: v.pipe(argument, v.trim(), v.minLength(1)),
  args: v.optional(v.pipe(v.array(argument), v.maxLength(128)), []),
  env: v.optional(environmentSchema, {}),
  disabled: v.optional(v.boolean(), false),
  autoApprove: v.optional(v.pipe(v.array(v.string()), v.maxLength(256)), [])
})
const servers = v.record(v.string(), importedServer)
const importSchema = v.union([
  v.pipe(
    v.object({ mcpServers: servers }),
    v.transform((value) => value.mcpServers)
  ),
  servers
])

export function parseMCPImport(
  text: string
): { draft: MCPConnectionDraft; environment: Record<string, string> }[] {
  const result = v.safeParse(
    v.pipe(v.string(), v.maxLength(131_072), v.parseJson(), importSchema),
    text
  )
  if (!result.success) throw new Error('Invalid MCP configuration.')
  return Object.entries(result.output).map(([name, config]) => ({
    draft: {
      id: null,
      name,
      url: '',
      transportType: 'stdio',
      command: config.command,
      args: config.args,
      enabled: !config.disabled,
      autoApprove: config.autoApprove,
      authenticationType: 'none'
    } satisfies MCPConnectionDraft,
    environment: config.env
  }))
}

export function parseMCPEnvironment(text: string): Record<string, string> {
  const result = v.safeParse(
    v.pipe(v.string(), v.maxLength(16_000), v.parseJson(), environmentSchema),
    text || '{}'
  )
  if (!result.success) throw new Error('Invalid MCP environment JSON.')
  return result.output
}
