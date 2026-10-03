import { inject, type InjectionKey } from 'vue'

import { ACP_AGENTS, type ACPAgentID } from '@open-pencil/core/constants'

import type { ACPModelCatalog } from '@/app/ai/acp/models'

const DISCOVERY_TIMEOUT_MS = 30_000

export type AgentModelLoader = (id: ACPAgentID, signal?: AbortSignal) => Promise<ACPModelCatalog>
export const agentModelLoaderKey: InjectionKey<AgentModelLoader> = Symbol('agentModelLoader')

export async function loadAgentModels(
  id: ACPAgentID,
  signal?: AbortSignal
): Promise<ACPModelCatalog> {
  const agentDef = ACP_AGENTS.find((agent) => agent.id === id)
  if (!agentDef) throw new Error('Unknown CLI provider')
  const [{ ACPChatTransport }, { homeDir }] = await Promise.all([
    import('@/app/ai/acp/transport'),
    import('@tauri-apps/api/path')
  ])
  const transport = new ACPChatTransport({ agentDef, cwd: await homeDir(), purpose: 'catalog' })
  const cancel = () => {
    void transport.destroy().catch(() => undefined)
  }
  signal?.addEventListener('abort', cancel, { once: true })
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    signal?.throwIfAborted()
    return await Promise.race([
      transport.listModels(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          void transport.destroy().catch(() => undefined)
          reject(new Error('CLI model discovery timed out'))
        }, DISCOVERY_TIMEOUT_MS)
      })
    ])
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', cancel)
    await transport.destroy()
  }
}

export function useAgentModelLoader(): AgentModelLoader {
  return inject(agentModelLoaderKey, loadAgentModels)
}
