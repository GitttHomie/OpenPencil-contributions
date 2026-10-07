import type { ClientSideConnection, SessionConfigOption } from '@agentclientprotocol/sdk'
import * as v from 'valibot'

export const acpThinkingSelectionSchema = v.object({
  configId: v.pipe(v.string(), v.minLength(1)),
  value: v.string()
})

export type ACPThinkingSelection = v.InferOutput<typeof acpThinkingSelectionSchema>

export interface ACPThinkingControl {
  id: string
  name: string
  currentValue: string
  options: { value: string; name: string }[]
}

export function sessionThinkingControl(
  options: SessionConfigOption[] | null | undefined
): ACPThinkingControl | undefined {
  const control = options?.find((option) => option.category === 'thought_level')
  if (!control) return undefined
  return {
    id: control.id,
    name: control.name,
    currentValue: control.currentValue,
    options: control.options
      .flatMap((option) => ('options' in option ? option.options : [option]))
      .map(({ value, name }) => ({ value, name }))
  }
}

export function parseACPThinkingSelection(value: unknown): ACPThinkingSelection | undefined {
  const result = v.safeParse(acpThinkingSelectionSchema, value)
  return result.success ? result.output : undefined
}

export async function applySessionThinking(
  connection: Pick<ClientSideConnection, 'setSessionConfigOption'>,
  sessionId: string,
  control: ACPThinkingControl | undefined,
  selection: ACPThinkingSelection | undefined
): Promise<SessionConfigOption[] | undefined> {
  if (!selection) return undefined
  if (
    !control ||
    control.id !== selection.configId ||
    !control.options.some((option) => option.value === selection.value)
  ) {
    throw new Error(
      'The CLI no longer offers the selected thinking level. Refresh its model settings.'
    )
  }
  if (control.currentValue === selection.value) return undefined
  const response = await connection.setSessionConfigOption({
    sessionId,
    configId: selection.configId,
    value: selection.value
  })
  const updated = sessionThinkingControl(response.configOptions)
  if (updated?.id !== selection.configId || updated.currentValue !== selection.value) {
    throw new Error('The CLI did not activate the selected thinking level.')
  }
  return response.configOptions
}
