import type {
  ClientSideConnection,
  NewSessionResponse,
  SessionConfigOption
} from '@agentclientprotocol/sdk'
import * as v from 'valibot'

import { sessionControls, sessionControlSchema } from './configuration/session'
import { sessionThinkingControl } from './thinking'

export const acpModelCatalogSchema = v.object({
  controls: v.optional(v.array(sessionControlSchema)),
  thinking: v.optional(
    v.object({
      id: v.string(),
      name: v.string(),
      currentValue: v.string(),
      options: v.array(v.object({ value: v.string(), name: v.string() }))
    })
  ),
  models: v.array(
    v.object({
      id: v.string(),
      name: v.string(),
      description: v.optional(v.string())
    })
  ),
  currentModelId: v.string(),
  selector: v.nullable(
    v.variant('kind', [
      v.object({ kind: v.literal('config'), id: v.string() }),
      v.object({ kind: v.literal('legacy') })
    ])
  )
})

export type ACPModelCatalog = v.InferOutput<typeof acpModelCatalogSchema>
export type ACPModelOption = ACPModelCatalog['models'][number]

export class ACPModelSelectionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ACPModelSelectionError'
  }
}

function configModel(options: SessionConfigOption[] | null | undefined) {
  return (
    options?.find((option) => option.category === 'model') ??
    options?.find((option) => option.id === 'model')
  )
}

export function sessionModelCatalog(
  response: Pick<NewSessionResponse, 'configOptions' | 'models'>
): ACPModelCatalog {
  const controls = sessionControls(response.configOptions)
  const thinking = sessionThinkingControl(response.configOptions)
  const config = configModel(response.configOptions)
  if (config) {
    const options = config.options.flatMap((option) =>
      'options' in option ? option.options : [option]
    )
    return {
      thinking,
      controls,
      selector: { kind: 'config', id: config.id },
      currentModelId: config.currentValue,
      models: options.map((option) => ({
        id: option.value,
        name: option.name,
        description: option.description ?? undefined
      }))
    }
  }
  if (response.models) {
    return {
      thinking,
      controls,
      selector: { kind: 'legacy' },
      currentModelId: response.models.currentModelId,
      models: response.models.availableModels.map((model) => ({
        id: model.modelId,
        name: model.name,
        description: model.description ?? undefined
      }))
    }
  }
  return { selector: null, models: [], currentModelId: '', thinking, controls }
}

/** Preserve legacy model metadata when a config update contains only session controls. */
export function updateSessionCatalog(
  current: ACPModelCatalog,
  configOptions: SessionConfigOption[]
) {
  const next = sessionModelCatalog({ configOptions })
  return next.selector ? next : { ...current, thinking: next.thinking, controls: next.controls }
}

export async function applySessionModel(
  connection: Pick<ClientSideConnection, 'setSessionConfigOption' | 'unstable_setSessionModel'>,
  sessionId: string,
  catalog: ACPModelCatalog,
  modelId: string
): Promise<ACPModelCatalog> {
  if (!modelId) return catalog
  if (!catalog.selector) {
    throw new ACPModelSelectionError(
      'This CLI does not expose model selection. Choose CLI default or update its adapter.'
    )
  }
  if (!catalog.models.some((model) => model.id === modelId)) {
    throw new ACPModelSelectionError(
      'Model not found in this CLI account. Refresh the model list in Settings.'
    )
  }
  if (catalog.currentModelId === modelId) return catalog
  if (catalog.selector.kind === 'config') {
    const response = await connection.setSessionConfigOption({
      sessionId,
      configId: catalog.selector.id,
      value: modelId
    })
    const updated = sessionModelCatalog(response)
    if (updated.currentModelId !== modelId) {
      throw new ACPModelSelectionError(
        'The CLI did not activate the selected model. Refresh the model list in Settings.'
      )
    }
    return updated
  }
  await connection.unstable_setSessionModel({ sessionId, modelId })
  return { ...catalog, currentModelId: modelId }
}
