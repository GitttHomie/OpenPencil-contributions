import * as v from 'valibot'

const identifier = v.pipe(v.string(), v.regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/))
const label = v.pipe(v.string(), v.minLength(1), v.maxLength(160))
const field = v.strictObject({
  id: identifier,
  label,
  labelKey: v.optional(v.picklist(['cliCodexProvider', 'baseURL', 'cliAWSRegion'])),
  hintKey: v.optional(v.literal('cliCodexProviderHint')),
  hint: v.optional(v.pipe(v.string(), v.maxLength(500))),
  type: v.picklist(['text', 'url', 'identifier', 'region', 'select']),
  options: v.optional(v.pipe(v.array(v.strictObject({ value: label, label })), v.maxLength(100))),
  target: v.variant('kind', [
    v.strictObject({
      kind: v.literal('env'),
      names: v.pipe(
        v.array(v.pipe(v.string(), v.regex(/^[A-Z][A-Z0-9_]{0,79}$/))),
        v.minLength(1),
        v.maxLength(4)
      )
    }),
    v.strictObject({
      kind: v.literal('config'),
      flag: v.picklist(['-c', '--config']),
      key: v.pipe(v.string(), v.regex(/^[a-zA-Z0-9_.{}-]{1,200}$/))
    })
  ])
})

export const integrationSchema = v.strictObject({
  version: v.literal(1),
  agent: v.picklist(['codex', 'claude-code', 'gemini-cli', 'kiro-cli']),
  fields: v.pipe(v.array(field), v.maxLength(24))
})
export type ACPIntegration = v.InferOutput<typeof integrationSchema>
export type ACPIntegrationField = ACPIntegration['fields'][number]

const protectedEnvironment =
  /^(PATH|HOME|USERPROFILE|CODEX_HOME|NODE_OPTIONS|BUN_OPTIONS|SHELL|ENV|BASH_ENV|ZDOTDIR|PYTHONPATH|PYTHONHOME|COMSPEC|PATHEXT|LD_.*|DYLD_.*)$/
const secretName = /(?:secret|password|token|api[_-]?key|access[_-]?key|credential)/i

export function validateIntegration(value: unknown): ACPIntegration {
  const configuration = v.parse(integrationSchema, value)
  const fields = new Map(configuration.fields.map((entry) => [entry.id, entry]))
  if (fields.size !== configuration.fields.length) throw new Error('Duplicate field IDs.')
  const targets = new Set<string>()
  for (const entry of configuration.fields) {
    if (Object.hasOwn(Object.prototype, entry.id)) throw new Error('Reserved field ID.')
    const mappings =
      entry.target.kind === 'env'
        ? entry.target.names.map((name) => `env:${name}`)
        : [`config:${entry.target.key}`]
    for (const mapping of mappings) {
      if (targets.has(mapping)) throw new Error('Multiple fields cannot override the same setting.')
      targets.add(mapping)
    }
    if (secretName.test(entry.id)) throw new Error('Use the credential manager for secrets.')
    if (
      entry.type === 'select' &&
      (!entry.options?.length ||
        new Set(entry.options.map((option) => option.value)).size !== entry.options.length)
    ) {
      throw new Error('Select fields need unique choices.')
    }
    if (entry.target.kind === 'env') {
      if (
        entry.target.names.some((name) => protectedEnvironment.test(name) || secretName.test(name))
      ) {
        throw new Error('This environment setting cannot be overridden here.')
      }
    } else {
      if (secretName.test(entry.target.key))
        throw new Error('Use the credential manager for secrets.')
      const key = entry.target.key.replace(/\{([a-zA-Z][a-zA-Z0-9_-]*)\}/g, (_, id: string) => {
        if (fields.get(id)?.type !== 'identifier')
          throw new Error('Key references must name an identifier field.')
        return 'identifier'
      })
      if (
        key
          .split('.')
          .some((part) => /^(command|args|env|shell|hooks|notify|mcp_servers)$/i.test(part))
      )
        throw new Error('Executable configuration is not supported here.')
      if (!/^[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*$/.test(key))
        throw new Error('Invalid configuration key.')
    }
  }
  return configuration
}

export function parseIntegration(text: string): ACPIntegration {
  const parsed = v.safeParse(
    v.pipe(v.string(), v.maxLength(32_768), v.parseJson(), integrationSchema),
    text
  )
  if (!parsed.success) throw new Error('Invalid integration configuration.')
  return validateIntegration(parsed.output)
}
