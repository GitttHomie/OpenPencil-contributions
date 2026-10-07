import { generateText } from 'ai'
import { fromUint8Array } from 'js-base64'

import { ACP_AGENTS } from '@open-pencil/core/constants'
import { computeContentBounds } from '@open-pencil/core/io'

import { reasoningCallSettings } from '@/app/ai/chat/reasoning'
import { createAIModelRuntime, type ACPModelRuntime } from '@/app/ai/models'
import { boundedImageScale } from '@/app/ai/tools/vision'
import type { EditorStore } from '@/app/editor/active-store'

import instructions from './instructions.md?raw'
import { captureReviewSnapshot } from './snapshot'

const MAX_OUTPUT_TOKENS = 2400
const MAX_IMAGE_EDGE = 1600

export class DesignReviewError extends Error {
  constructor(public reason: 'unconfigured' | 'empty' | 'failed') {
    super(reason)
    this.name = 'DesignReviewError'
  }
}

export interface ReviewResult {
  text: string
  profileName: string
  imageIncluded: boolean
  nodeIds: string[]
}

export interface ReviewRequest {
  focus: string
  signal: AbortSignal
}

async function createReviewAgent(runtime: ACPModelRuntime, image: Uint8Array | null) {
  const agentDef = ACP_AGENTS.find(
    (agent) => `acp:${agent.id}` === runtime.role.connection.providerID
  )
  if (!agentDef) throw new DesignReviewError('unconfigured')
  const [{ ACPChatTransport }, { homeDir }] = await Promise.all([
    import('@/app/ai/acp/transport'),
    import('@tauri-apps/api/path')
  ])
  return new ACPChatTransport({
    agentDef,
    cwd: await homeDir(),
    purpose: 'review',
    launch: runtime.role.profile.acpLaunch,
    integration: runtime.role.profile.acpIntegration,
    sessionValues: runtime.role.profile.acpOptions,
    modelId: runtime.role.profile.customModelID || runtime.role.profile.modelID,
    thinking: () => runtime.role.profile.acpThinking,
    image: image ? fromUint8Array(image) : undefined
  })
}

export interface ReviewDependencies {
  createRuntime: typeof createAIModelRuntime
  generate: typeof generateText
  createAgent: typeof createReviewAgent
}

async function reviewWithAgent(
  runtime: ACPModelRuntime,
  prompt: string,
  image: Uint8Array | null,
  signal: AbortSignal,
  createAgent: ReviewDependencies['createAgent']
) {
  const transport = await createAgent(runtime, image)
  const cancel = () => {
    void transport.destroy().catch(() => undefined)
  }
  signal.addEventListener('abort', cancel, { once: true })
  try {
    signal.throwIfAborted()
    const stream = await transport.sendMessages({
      chatId: crypto.randomUUID(),
      trigger: 'submit-message',
      messageId: undefined,
      messages: [
        { id: crypto.randomUUID(), role: 'user', parts: [{ type: 'text', text: prompt }] }
      ],
      abortSignal: signal
    })
    const reader = stream.getReader()
    let text = ''
    try {
      for (;;) {
        const next = await reader.read()
        if (next.done) break
        if (next.value.type === 'error') throw new DesignReviewError('failed')
        if (next.value.type === 'text-delta') text += next.value.delta
      }
    } finally {
      reader.releaseLock()
    }
    signal.throwIfAborted()
    return { text, imageIncluded: transport.imageIncluded }
  } finally {
    signal.removeEventListener('abort', cancel)
    await transport.destroy()
  }
}

export async function reviewDesign(
  store: EditorStore,
  request: ReviewRequest,
  dependencies: ReviewDependencies = {
    createRuntime: createAIModelRuntime,
    generate: generateText,
    createAgent: createReviewAgent
  }
): Promise<ReviewResult> {
  const snapshot = captureReviewSnapshot(store)
  if (!snapshot.count) throw new DesignReviewError('empty')
  request.signal.throwIfAborted()
  const runtime = await dependencies.createRuntime('review')
  if (!runtime || runtime.kind === 'harness') throw new DesignReviewError('unconfigured')
  request.signal.throwIfAborted()
  const wantsImage = runtime.kind === 'acp' || runtime.role.profile.capabilities.includes('vision')
  const bounds = computeContentBounds(store.graph, snapshot.rootIds)
  let image: Uint8Array | null = null
  if (wantsImage && bounds) {
    const scale = boundedImageScale(
      bounds.maxX - bounds.minX,
      bounds.maxY - bounds.minY,
      MAX_IMAGE_EDGE
    )
    if (scale > 0) {
      image = await store.renderExportImage(snapshot.rootIds, scale, 'PNG', snapshot.pageId)
    }
  }
  request.signal.throwIfAborted()
  const prompt = [
    instructions.trim(),
    request.focus.trim() ? `User's review focus:\n${request.focus.trim()}` : '',
    `Design snapshot:\n${snapshot.text}`
  ]
    .filter(Boolean)
    .join('\n\n')
  let result: { text: string; imageIncluded: boolean }
  if (runtime.kind === 'acp') {
    result = await reviewWithAgent(runtime, prompt, image, request.signal, dependencies.createAgent)
  } else {
    const content: Array<
      { type: 'text'; text: string } | { type: 'file'; mediaType: string; data: Uint8Array }
    > = [{ type: 'text', text: prompt }]
    if (image) content.push({ type: 'file', mediaType: 'image/png', data: image })
    else
      content.push({
        type: 'text',
        text: 'No screenshot is available. Review structure only; do not claim to have checked rendered appearance.'
      })
    const response = await dependencies.generate({
      model: runtime.model,
      abortSignal: request.signal,
      maxRetries: 0,
      maxOutputTokens: Math.min(runtime.role.profile.maxOutputTokens, MAX_OUTPUT_TOKENS),
      ...reasoningCallSettings(
        runtime.role.connection.providerID,
        runtime.role.profile.thinkingLevel
      ),
      messages: [{ role: 'user', content }]
    })
    result = { text: response.text, imageIncluded: Boolean(image) }
  }
  request.signal.throwIfAborted()
  if (!result.text.trim()) throw new DesignReviewError('failed')
  return { ...result, profileName: runtime.role.profile.name, nodeIds: snapshot.rootIds }
}
