import { generateText } from 'ai'
import { fromUint8Array } from 'js-base64'

import { ACP_AGENTS } from '@open-pencil/core/constants'

import { requestAgentText } from '@/app/ai/acp/text-request'
import type { ACPChatTransport } from '@/app/ai/acp/transport'
import { reasoningCallSettings } from '@/app/ai/chat/reasoning'
import type { ACPModelRuntime, AIModelRuntime } from '@/app/ai/models/runtime'

export type InspectionImage = { data: Uint8Array; mediaType: string }
export type InspectionAgent = Pick<ACPChatTransport, 'sendMessages' | 'destroy' | 'imageIncluded'>
export type InspectionDependencies = {
  inspect: typeof generateText
  createAgent?: (runtime: ACPModelRuntime, images: InspectionImage[]) => Promise<InspectionAgent>
}

async function createInspectionAgent(runtime: ACPModelRuntime, images: InspectionImage[]) {
  const agentDef = ACP_AGENTS.find(
    (agent) => `acp:${agent.id}` === runtime.role.connection.providerID
  )
  if (!agentDef) throw new Error('Unknown image-analysis agent.')
  const [{ ACPChatTransport }, { homeDir }] = await Promise.all([
    import('@/app/ai/acp/transport'),
    import('@tauri-apps/api/path')
  ])
  return new ACPChatTransport({
    agentDef,
    cwd: await homeDir(),
    purpose: 'vision',
    modelId: runtime.role.profile.customModelID || runtime.role.profile.modelID,
    launch: runtime.role.profile.acpLaunch,
    integration: runtime.role.profile.acpIntegration,
    sessionValues: runtime.role.profile.acpOptions,
    thinking: () => runtime.role.profile.acpThinking,
    images: images.map((image) => ({
      data: fromUint8Array(image.data),
      mimeType: image.mediaType
    }))
  })
}

/** Both transports receive the same images; CLI inspection has no canvas MCP connection. */
export async function inspectImages(
  runtime: AIModelRuntime | null,
  prompt: string,
  images: InspectionImage[],
  dependencies: InspectionDependencies = { inspect: generateText },
  signal?: AbortSignal
): Promise<string> {
  if (!runtime || runtime.kind === 'harness') {
    throw new Error('Configure an image-capable model in Settings to inspect images.')
  }
  if (!images.length) throw new Error('No images supplied for visual inspection.')
  const controller = new AbortController()
  const cancel = () => controller.abort(signal?.reason)
  signal?.addEventListener('abort', cancel, { once: true })
  if (signal?.aborted) cancel()
  const timer = setTimeout(() => controller.abort(new Error('Image inspection timed out.')), 90_000)
  let agent: InspectionAgent | undefined
  const stopAgent = () => {
    void agent?.destroy()
  }
  controller.signal.addEventListener('abort', stopAgent, { once: true })
  try {
    controller.signal.throwIfAborted()
    if (runtime.kind === 'direct') {
      const result = await dependencies.inspect({
        model: runtime.model,
        abortSignal: controller.signal,
        maxOutputTokens: Math.min(runtime.role.profile.maxOutputTokens, 1200),
        ...reasoningCallSettings(
          runtime.role.connection.providerID,
          runtime.role.profile.thinkingLevel
        ),
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              ...images.map((image) => ({ type: 'file' as const, ...image }))
            ]
          }
        ]
      })
      return result.text
    }
    agent = await (dependencies.createAgent ?? createInspectionAgent)(runtime, images)
    const text = await requestAgentText(agent, prompt, controller.signal)
    if (!agent.imageIncluded) throw new Error('The agent did not receive the images.')
    if (!text.trim()) throw new Error('The agent returned no visual findings.')
    return text
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', cancel)
    controller.signal.removeEventListener('abort', stopAgent)
    await agent?.destroy()
  }
}
