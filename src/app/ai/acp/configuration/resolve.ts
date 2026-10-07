import type { ACPAgentID } from '@open-pencil/core/constants'

import defaults from './defaults.json'
import { validateIntegration, type ACPIntegration, type ACPIntegrationField } from './schema'

export function integrationFor(id: ACPAgentID, custom?: ACPIntegration) {
  const configuration = validateIntegration(custom ?? defaults[id])
  if (configuration.agent !== id) throw new Error('This integration belongs to another CLI.')
  return configuration
}

function validEndpoint(value: string) {
  try {
    const url = new URL(value)
    return (
      ['http:', 'https:'].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    )
  } catch {
    return false
  }
}

export function fieldError(
  field: ACPIntegrationField,
  values: Record<string, string>
): 'characters' | 'identifier' | 'region' | 'choice' | 'url' | 'dependency' | undefined {
  const value = values[field.id]?.trim() ?? ''
  if (!value) return undefined
  // npm adapters may run through cmd.exe; all substitutions must remain literal.
  if (value.length > 2048 || /[\s"'`$&|<>^%!\\()]/.test(value)) return 'characters'
  if (field.type === 'identifier' && !/^[a-zA-Z0-9_-]+$/.test(value)) return 'identifier'
  if (field.type === 'region' && !/^[a-z]{2}(?:-[a-z]+)+-\d+$/.test(value)) return 'region'
  if (field.type === 'select' && !field.options?.some((option) => option.value === value))
    return 'choice'
  if (field.type === 'url' && !validEndpoint(value)) return 'url'
  if (field.target.kind === 'config') {
    const references = [...field.target.key.matchAll(/\{([^}]+)\}/g)]
    if (references.some(([, id]) => !values[id]?.trim())) return 'dependency'
  }
  return undefined
}

export function resolveIntegration(configuration: ACPIntegration, values: Record<string, string>) {
  const args: string[] = []
  const env: Record<string, string> = {}
  for (const field of configuration.fields) {
    if (fieldError(field, values)) throw new Error('Invalid connection setting.')
    const value = values[field.id]?.trim()
    if (!value) continue
    if (field.target.kind === 'env') {
      for (const name of field.target.names) env[name] = value
    } else {
      const key = field.target.key.replace(/\{([^}]+)\}/g, (_, id: string) => values[id].trim())
      args.push(field.target.flag, `${key}=${JSON.stringify(value)}`)
    }
  }
  return { args, env }
}
