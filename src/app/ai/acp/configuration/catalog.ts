import type { ClientSideConnection } from '@agentclientprotocol/sdk'

import { updateSessionCatalog, type ACPModelCatalog } from '../models'
import { applySessionControls, type ACPSessionValues } from './session'

/** Metadata sessions retain defaults so clearing an override can restore dependent choices. */
export async function applyCatalogControls(
  connection: Pick<ClientSideConnection, 'setSessionConfigOption'>,
  sessionId: string,
  catalog: ACPModelCatalog,
  defaults: Map<string, ACPSessionValues>,
  values?: ACPSessionValues
) {
  const currentModel = catalog.currentModelId
  if (!defaults.has(currentModel)) {
    defaults.set(
      currentModel,
      Object.fromEntries(
        (catalog.controls ?? []).map((control) => [control.id, control.currentValue])
      )
    )
  }
  // Retain unavailable saved choices in the form, where users can reset them.
  const available = Object.fromEntries(
    Object.entries({ ...defaults.get(currentModel), ...values }).filter(([id, value]) =>
      catalog.controls?.some(
        (control) => control.id === id && control.options.some((option) => option.value === value)
      )
    )
  )
  const configured = await applySessionControls(
    connection,
    sessionId,
    catalog.controls ?? [],
    available
  )
  return configured ? updateSessionCatalog(catalog, configured) : catalog
}
