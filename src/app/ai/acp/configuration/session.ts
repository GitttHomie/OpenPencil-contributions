import type { ClientSideConnection, SessionConfigOption } from '@agentclientprotocol/sdk'
import * as v from 'valibot'

export class ACPConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ACPConfigurationError'
  }
}

export const sessionControlSchema = v.object({
  id: v.string(),
  name: v.string(),
  description: v.optional(v.string()),
  currentValue: v.string(),
  options: v.array(v.object({ value: v.string(), name: v.string() }))
})
export type ACPSessionControl = v.InferOutput<typeof sessionControlSchema>
export type ACPSessionValues = Record<string, string>

/** Model/thinking have dedicated controls; permission modes remain owned by the app. */
export function sessionControls(options?: SessionConfigOption[] | null): ACPSessionControl[] {
  return (options ?? [])
    .filter(
      (option) =>
        option.id !== 'model' &&
        !['model', 'thought_level', 'mode'].includes(option.category ?? '') &&
        option.id !== 'mode'
    )
    .map((option) => ({
      id: option.id,
      name: option.name,
      description: option.description ?? undefined,
      currentValue: option.currentValue,
      options: option.options
        .flatMap((value) => ('options' in value ? value.options : [value]))
        .map(({ value, name }) => ({ value, name }))
    }))
}

export async function applySessionControls(
  connection: Pick<ClientSideConnection, 'setSessionConfigOption'>,
  sessionId: string,
  controls: ACPSessionControl[],
  values: ACPSessionValues = {}
): Promise<SessionConfigOption[] | undefined> {
  let updated: SessionConfigOption[] | undefined
  for (const [id, value] of Object.entries(values)) {
    const control = controls.find((option) => option.id === id)
    if (!control?.options.some((option) => option.value === value)) {
      throw new ACPConfigurationError(
        'A saved CLI option is no longer available. Refresh the model settings and reset that option to CLI default.'
      )
    }
    if (control.currentValue === value) continue
    const response = await connection.setSessionConfigOption({ sessionId, configId: id, value })
    updated = response.configOptions
    controls = sessionControls(updated)
    if (controls.find((option) => option.id === id)?.currentValue !== value) {
      throw new ACPConfigurationError(
        'The CLI did not apply a selected option. Refresh its model settings.'
      )
    }
  }
  assertSessionControlValues(controls, values)
  return updated
}

/** Other selectors can change these choices; check again immediately before inference. */
export function assertSessionControlValues(
  controls: ACPSessionControl[],
  values: ACPSessionValues = {}
) {
  if (
    Object.entries(values).some(
      ([id, value]) => controls.find((option) => option.id === id)?.currentValue !== value
    )
  ) {
    throw new ACPConfigurationError(
      'The selected CLI options conflict. Reset them to CLI defaults and choose again.'
    )
  }
}
