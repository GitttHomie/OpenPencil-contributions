import { tryOnScopeDispose } from '@vueuse/core'
import { inject, type InjectionKey } from 'vue'

import { ACP_AGENTS, type ACPAgentID } from '@open-pencil/core/constants'

import type { ACPIntegration } from '@/app/ai/acp/configuration/schema'
import type { ACPSessionValues } from '@/app/ai/acp/configuration/session'
import type { ACPLaunchSettings } from '@/app/ai/acp/launch'
import type { ACPModelCatalog } from '@/app/ai/acp/models'

const DISCOVERY_TIMEOUT_MS = 30_000

export type AgentModelLoader = (
  id: ACPAgentID,
  signal?: AbortSignal,
  modelId?: string,
  launch?: ACPLaunchSettings,
  fresh?: boolean,
  integration?: ACPIntegration,
  sessionValues?: ACPSessionValues
) => Promise<ACPModelCatalog>
export const agentModelLoaderKey: InjectionKey<AgentModelLoader> = Symbol('agentModelLoader')

type CatalogTransport = {
  listModels(modelId?: string, values?: ACPSessionValues): Promise<ACPModelCatalog>
  destroy(): Promise<void>
}
type DiscoveryEntry = {
  key: string
  transport: Promise<CatalogTransport>
  closing?: Promise<void>
}

async function createCatalogTransport(
  id: ACPAgentID,
  launch?: ACPLaunchSettings,
  integration?: ACPIntegration
) {
  const agentDef = ACP_AGENTS.find((agent) => agent.id === id)
  if (!agentDef) throw new Error('Unknown CLI provider')
  const [{ ACPChatTransport }, { homeDir }] = await Promise.all([
    import('@/app/ai/acp/transport'),
    import('@tauri-apps/api/path')
  ])
  return new ACPChatTransport({
    agentDef,
    cwd: await homeDir(),
    purpose: 'catalog',
    launch,
    integration
  })
}

/** Reuse one metadata-only process while the editor switches models. */
export function createAgentModelDiscovery(
  create: (
    id: ACPAgentID,
    launch?: ACPLaunchSettings,
    integration?: ACPIntegration
  ) => Promise<CatalogTransport> = createCatalogTransport
) {
  let active: DiscoveryEntry | null = null
  function close(entry: DiscoveryEntry) {
    if (active === entry) active = null
    entry.closing ??= entry.transport
      .then((transport) => transport.destroy())
      .catch(() => undefined)
    return entry.closing
  }
  const load: AgentModelLoader = async (
    id,
    signal,
    modelId,
    launch,
    fresh,
    integration,
    values
  ) => {
    signal?.throwIfAborted()
    const key = JSON.stringify([id, launch, integration])
    if (active && (fresh || active.key !== key)) await close(active)
    signal?.throwIfAborted()
    active ??= { key, transport: create(id, launch ? { ...launch } : undefined, integration) }
    const entry = active
    let timer: ReturnType<typeof setTimeout> | undefined
    let cancel: () => void = () => undefined
    try {
      const interrupted = new Promise<never>((_, reject) => {
        cancel = () => {
          void close(entry)
          reject(new Error('CLI model discovery cancelled.'))
        }
        signal?.addEventListener('abort', cancel, { once: true })
        timer = setTimeout(
          () => reject(new Error('CLI model discovery timed out.')),
          DISCOVERY_TIMEOUT_MS
        )
      })
      return await Promise.race([
        entry.transport.then((transport) => {
          signal?.throwIfAborted()
          if (entry.closing) throw new Error('CLI model discovery closed.')
          return transport.listModels(modelId, values)
        }),
        interrupted
      ])
    } catch (error) {
      void close(entry)
      throw error
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', cancel)
    }
  }
  return {
    load,
    async dispose() {
      if (active) await close(active)
    }
  }
}

export const loadAgentModels: AgentModelLoader = async (...args) => {
  const discovery = createAgentModelDiscovery()
  try {
    return await discovery.load(...args)
  } finally {
    await discovery.dispose()
  }
}

export function useAgentModelLoader(): AgentModelLoader {
  const provided = inject(agentModelLoaderKey, null)
  if (provided) return provided
  const discovery = createAgentModelDiscovery()
  tryOnScopeDispose(() => {
    void discovery.dispose()
  })
  return discovery.load
}
