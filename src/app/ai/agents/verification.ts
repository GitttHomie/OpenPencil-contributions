import { inject, type InjectionKey } from 'vue'

import { ACP_AGENTS } from '@open-pencil/core/constants'

import {
  classifyConnectionError,
  type ProviderConnectionTestResult
} from '@/app/ai/chat/connection-test'
import type { AIModelProfileDraft } from '@/app/ai/models/types'

type VerificationTarget = Pick<
  AIModelProfileDraft,
  | 'providerID'
  | 'modelID'
  | 'customModelID'
  | 'acpLaunch'
  | 'acpThinking'
  | 'acpIntegration'
  | 'acpOptions'
>
export type AgentModelVerifier = (
  target: VerificationTarget,
  signal: AbortSignal
) => Promise<ProviderConnectionTestResult>

export const agentModelVerifierKey: InjectionKey<AgentModelVerifier> = Symbol('agentModelVerifier')
const VERIFICATION_TIMEOUT_MS = 30_000

export const verifyAgentModel: AgentModelVerifier = async (target, signal) => {
  const definition = ACP_AGENTS.find((agent) => `acp:${agent.id}` === target.providerID)
  if (!definition) return { ok: false, reason: 'unknown' }
  const [{ ACPChatTransport }, { homeDir }] = await Promise.all([
    import('@/app/ai/acp/transport'),
    import('@tauri-apps/api/path')
  ])
  signal.throwIfAborted()
  const transport = new ACPChatTransport({
    agentDef: definition,
    cwd: await homeDir(),
    purpose: 'verification',
    modelId: target.customModelID || target.modelID,
    launch: target.acpLaunch,
    integration: target.acpIntegration,
    sessionValues: target.acpOptions,
    thinking: () => target.acpThinking
  })
  let timer: ReturnType<typeof setTimeout> | undefined
  let cancel: () => void = () => undefined
  try {
    const interrupted = new Promise<never>((_, reject) => {
      cancel = () => reject(new Error('Model verification cancelled.'))
      signal.addEventListener('abort', cancel, { once: true })
      timer = setTimeout(
        () => reject(new Error('Model verification timed out.')),
        VERIFICATION_TIMEOUT_MS
      )
    })
    signal.throwIfAborted()
    await Promise.race([transport.verifyModel(), interrupted])
    return { ok: true }
  } catch (error) {
    return { ok: false, reason: classifyConnectionError(error) }
  } finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', cancel)
    await transport.destroy()
  }
}

export function useAgentModelVerifier(): AgentModelVerifier {
  return inject(agentModelVerifierKey, verifyAgentModel)
}
