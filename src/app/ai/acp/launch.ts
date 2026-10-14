import * as v from 'valibot'

import type { ACPAgentID } from '@open-pencil/core/constants'

import { getACPAgentAdapter } from './adapters/registry'
import { integrationFor, resolveIntegration } from './configuration/resolve'
import type { ACPIntegration } from './configuration/schema'

/** Non-secret overrides passed only to the child process launched by OpenPencil. */
export const acpLaunchSchema = v.record(v.string(), v.string())
export type ACPLaunchSettings = v.InferOutput<typeof acpLaunchSchema>

export class ACPLaunchSettingsError extends Error {
  constructor() {
    super('Invalid OpenPencil CLI launch settings.')
    this.name = 'ACPLaunchSettingsError'
  }
}

export function parseACPLaunchSettings(value: unknown): ACPLaunchSettings | undefined {
  const parsed = v.safeParse(acpLaunchSchema, value)
  return parsed.success ? parsed.output : undefined
}

export function acpLaunchOptions(
  id: ACPAgentID,
  settings?: ACPLaunchSettings,
  integration?: ACPIntegration
) {
  try {
    const options = resolveIntegration(
      integrationFor(id, integration),
      v.parse(acpLaunchSchema, settings ?? {})
    )
    return getACPAgentAdapter(id).prepareLaunch?.(options) ?? options
  } catch {
    throw new ACPLaunchSettingsError()
  }
}
