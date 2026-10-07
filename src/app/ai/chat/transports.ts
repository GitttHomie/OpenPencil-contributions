import { Chat } from '@ai-sdk/vue'
import { useEventListener } from '@vueuse/core'
import { createUIMessageStream, DirectChatTransport, stepCountIs, ToolLoopAgent } from 'ai'
import type {
  ChatTransport,
  FinishReason,
  LanguageModel,
  ToolExecutionOptions,
  UIMessage
} from 'ai'
import type { ComputedRef, Ref } from 'vue'
import { ref } from 'vue'

import { ACP_AGENTS } from '@open-pencil/core/constants'
import type { ACPAgentID, AIProviderID } from '@open-pencil/core/constants'

import { createACPCanvasActivity } from '@/app/ai/acp/canvas/activity'
import { createCanvasSession } from '@/app/ai/acp/canvas/session'
import type { ACPChatTransport } from '@/app/ai/acp/transport'
import { AgentSetupError, assertAgentReady } from '@/app/ai/agents/readiness'
import { acpChatThinkingState } from '@/app/ai/chat/acp-thinking'
import { classifyAIChatError, type AIChatFailure } from '@/app/ai/chat/failure'
import { resolveLanguageModelID } from '@/app/ai/chat/model'
import { reasoningCallSettings, type AIProviderOptions } from '@/app/ai/chat/reasoning'
import SYSTEM_PROMPT from '@/app/ai/chat/system-prompt'
import { chatThinkingLevel } from '@/app/ai/chat/thinking'
import {
  createAIModelRuntime,
  resolveAIModelRole,
  resolveModelConnectionAPIKey
} from '@/app/ai/models'
import type { ThinkingLevel } from '@/app/ai/models/types'
import { createCanvasJSXPreview } from '@/app/ai/preview/canvas'
import { LAYA_SUPPORTED } from '@/app/ai/routing/preferences'
import { resetRoutingDecision, routingOptions } from '@/app/ai/routing/session'
import { createRoutingTransport } from '@/app/ai/routing/transport'
import { createAITools, endRun, recordStep, runPageId, startRun } from '@/app/ai/tools'
import { enabledAIToolDefinitions } from '@/app/ai/tools/catalog'
import { aiToolOverrides } from '@/app/ai/tools/preferences'
import { resetRunTracking } from '@/app/ai/tools/run'
import { diagnosticErrorDetails } from '@/app/diagnostics'
import {
  recordChatCompleted,
  recordChatFailed,
  recordModelStepCompleted
} from '@/app/diagnostics/events'
import type { AIDiagnosticContext } from '@/app/diagnostics/events/ai'
import type { getActiveEditorStore } from '@/app/editor/active-store'

import { resumableTransport } from './history/continuation'
import { maxAgentSteps } from './preferences'
import { createChatRunState } from './run-state'
import { createChatTiming } from './timing'

type EditorStore = ReturnType<typeof getActiveEditorStore>

type ChatSessionOptions = {
  isConfigured: ComputedRef<boolean>
  isACPProvider: ComputedRef<boolean>
  isHarnessProvider: ComputedRef<boolean>
  providerID: Ref<AIProviderID>
  credentialsReady: Promise<void>
  getActiveEditorStore: () => EditorStore
}

export type ToolLoopTransportOptions = {
  store: EditorStore
  providerID: AIProviderID
  model: LanguageModel
  effectiveModelID: string
  maxOutputTokens: number
  /** Read per request, so the composer's level applies to the next message. */
  thinkingLevel: () => ThinkingLevel
  onError?: (error: unknown) => void
  diagnosticContext?: AIDiagnosticContext
}

const ANTHROPIC_CACHE_CONTROL = {
  anthropic: { cacheControl: { type: 'ephemeral' } }
} as const

function supportsAnthropicCaching(providerID: AIProviderID, modelID: string): boolean {
  return (
    providerID === 'anthropic' ||
    providerID === 'anthropic-compatible' ||
    (providerID === 'openrouter' && modelID.startsWith('anthropic/'))
  )
}

function mergeProviderOptions(
  cacheOptions: typeof ANTHROPIC_CACHE_CONTROL | undefined,
  reasoningOptions: AIProviderOptions | undefined
): AIProviderOptions | undefined {
  if (!cacheOptions && !reasoningOptions) return undefined
  return { ...cacheOptions, ...reasoningOptions }
}

function callSettings(
  providerID: AIProviderID,
  cacheOptions: typeof ANTHROPIC_CACHE_CONTROL | undefined,
  thinkingLevel: ThinkingLevel
) {
  const { reasoning, providerOptions } = reasoningCallSettings(providerID, thinkingLevel)
  return { reasoning, providerOptions: mergeProviderOptions(cacheOptions, providerOptions) }
}

export async function createACPTransport(
  providerID: AIProviderID,
  modelId = '',
  options: Pick<
    ConstructorParameters<typeof ACPChatTransport>[0],
    'thinking' | 'onCatalog' | 'activity' | 'chatId' | 'launch' | 'integration' | 'sessionValues'
  > = {}
) {
  const agentId = providerID.replace('acp:', '') as ACPAgentID
  const agentDef = ACP_AGENTS.find((a) => a.id === agentId)
  if (!agentDef) throw new Error(`Unknown ACP agent: ${agentId}`)

  const { ACPChatTransport } = await import('@/app/ai/acp/transport')
  const { homeDir } = await import('@tauri-apps/api/path')
  return new ACPChatTransport({ agentDef, cwd: await homeDir(), modelId, ...options })
}

export function createToolLoopTransport({
  store,
  providerID,
  model,
  effectiveModelID,
  maxOutputTokens,
  thinkingLevel,
  onError,
  diagnosticContext = {}
}: ToolLoopTransportOptions) {
  const tools = createAITools(store, diagnosticContext)
  const preview = createCanvasJSXPreview(store, () => runPageId(store))
  const renderTool = tools.render
  renderTool.onInputStart = ({ toolCallId, abortSignal }) => preview.start(toolCallId, abortSignal)
  renderTool.onInputDelta = ({ toolCallId, inputTextDelta }) =>
    preview.delta(toolCallId, inputTextDelta)
  renderTool.onInputAvailable = ({ toolCallId }: ToolExecutionOptions<unknown>) =>
    preview.finish(toolCallId)
  const cacheProviderOptions = supportsAnthropicCaching(providerID, effectiveModelID)
    ? ANTHROPIC_CACHE_CONTROL
    : undefined
  const agent = new ToolLoopAgent({
    model,
    instructions: SYSTEM_PROMPT,
    tools,
    maxOutputTokens,
    prepareCall: (options) => {
      const stepLimit = maxAgentSteps.value
      const enabledNames = new Set(
        enabledAIToolDefinitions(aiToolOverrides.value).map((tool) => tool.name)
      )
      preview.clear()
      startRun(store, stepLimit, effectiveModelID)
      return {
        ...options,
        stopWhen: stepCountIs(stepLimit),
        // Keep the full catalog for validating history; offer only enabled tools to this request.
        tools: Object.fromEntries(Object.entries(tools).filter(([name]) => enabledNames.has(name))),
        maxOutputTokens,
        ...callSettings(providerID, cacheProviderOptions, thinkingLevel())
      }
    },
    onFinish: () => {
      preview.clear()
      endRun(store)
    },
    onStepFinish: ({ usage }) => {
      preview.clear()
      recordStep(store)
      recordModelStepCompleted(
        {
          provider: providerID,
          model: effectiveModelID,
          inputTokens: usage.inputTokens ?? null,
          outputTokens: usage.outputTokens ?? null,
          cacheReadTokens: usage.inputTokenDetails.cacheReadTokens ?? null,
          cacheWriteTokens: usage.inputTokenDetails.cacheWriteTokens ?? null
        },
        diagnosticContext
      )
    }
  })

  function handleError(error: unknown): string {
    preview.clear()
    endRun(store)
    onError?.(error)
    return 'The provider rejected the request.'
  }
  const transport = new DirectChatTransport({
    agent,
    onError: handleError
  }) as ChatTransport<UIMessage>
  return resumableTransport({
    reconnectToStream: (options) => transport.reconnectToStream(options),
    async sendMessages(options) {
      // Stopping a reply ends the run without onFinish.
      if (options.abortSignal) useEventListener(options.abortSignal, 'abort', () => endRun(store))
      // DirectChatTransport handles error chunks, but not a rejected underlying stream.
      return createUIMessageStream<UIMessage>({
        execute: async ({ writer }) => {
          writer.merge(await transport.sendMessages(options))
        },
        onError: handleError
      })
    }
  })
}

export function createChatSessionManager({
  isConfigured,
  isACPProvider,
  isHarnessProvider,
  credentialsReady,
  getActiveEditorStore
}: ChatSessionOptions) {
  const failure = ref<AIChatFailure | null>(null)
  let transportDirty = false
  let currentChatStore: EditorStore | null = null
  const currentChatMessages = new WeakMap<EditorStore, UIMessage[]>()
  let chat: Chat<UIMessage> | null = null
  let acpTransportInstance: { destroy(): Promise<void> } | null = null
  let harnessTransportInstance: { stop(): Promise<void> } | null = null
  let overrideTransport: (() => ChatTransport<UIMessage>) | null = null
  let activeProviderError: unknown = null
  const runs = new WeakMap<Chat<UIMessage>, ReturnType<typeof createChatRunState>>()

  function captureProviderError(error: unknown): void {
    activeProviderError ??= error
  }

  function handleChatFinish(
    context: AIDiagnosticContext,
    timing: ReturnType<typeof createChatTiming>,
    {
      finishReason,
      isAbort,
      isDisconnect,
      isError
    }: {
      finishReason?: FinishReason
      isAbort: boolean
      isDisconnect: boolean
      isError: boolean
    }
  ): void {
    if (!isAbort && !isDisconnect && !isError) {
      recordChatCompleted({ finishReason: finishReason ?? null, ...timing.snapshot() }, context)
    }
  }

  function clearFailure(): void {
    activeProviderError = null
    failure.value = null
  }

  function markTransportDirty() {
    transportDirty = true
  }

  async function destroyAgentTransports(): Promise<void> {
    const acp = acpTransportInstance
    const harness = harnessTransportInstance
    acpTransportInstance = null
    harnessTransportInstance = null
    const results = await Promise.allSettled([acp?.destroy(), harness?.stop()])
    const errors = results
      .filter((result) => result.status === 'rejected')
      .map((result) => result.reason)
    if (errors.length) throw new AggregateError(errors, 'Agent transport teardown failed')
  }

  async function createActiveACPTransport(store: EditorStore, role: 'design' | 'fast' = 'design') {
    await destroyAgentTransports()
    await assertAgentReady('acp')
    const runtime = await createAIModelRuntime(role)
    if (runtime?.kind !== 'acp') throw new Error('The Design model is not a CLI profile')
    const thinking = role === 'design' ? acpChatThinkingState(store, runtime.role.profile) : null
    const model = runtime.role.profile.customModelID || runtime.role.profile.modelID
    const canvas = createCanvasSession(store)
    const activity = createACPCanvasActivity(store, model || runtime.role.profile.name)
    try {
      const transport = await createACPTransport(runtime.role.connection.providerID, model, {
        chatId: canvas.id,
        launch: runtime.role.profile.acpLaunch,
        integration: runtime.role.profile.acpIntegration,
        sessionValues: runtime.role.profile.acpOptions,
        thinking: () => (thinking ? thinking.choice.value : runtime.role.profile.acpThinking),
        onCatalog: (catalog) => thinking?.publish(catalog),
        activity: {
          start() {
            canvas.start()
            activity.start()
          },
          update: (update) => activity.update(update),
          finish() {
            canvas.finish()
            activity.finish()
          }
        }
      })
      acpTransportInstance = {
        async destroy() {
          try {
            await transport.destroy()
          } finally {
            canvas.dispose()
            activity.dispose()
          }
        }
      }
      return transport as ChatTransport<UIMessage>
    } catch (error) {
      canvas.dispose()
      activity.dispose()
      throw error
    }
  }

  async function createActiveHarnessTransport(sessionId: string) {
    await destroyAgentTransports()
    const runtime = await createAIModelRuntime('design')
    if (runtime?.kind !== 'harness') throw new Error('The Design agent is not configured for Pi')
    await assertAgentReady('pi')
    const [{ HarnessChatTransport }, { buildPiMCPServers }, { readPiAccount }] = await Promise.all([
      import('@/app/ai/harness/transport'),
      import('@/app/integrations/mcp'),
      import('@/app/ai/harness/pi-settings')
    ])
    // A saved key is an AI Gateway key; without one, Pi uses the CLI's own sign-in.
    const apiKey = await resolveModelConnectionAPIKey(runtime.role.connection.id)
    const account = apiKey ? null : await readPiAccount()
    const model =
      runtime.role.profile.customModelID ||
      runtime.role.profile.modelID ||
      account?.defaultModel ||
      ''
    if (!apiKey && !account?.signedIn) throw new AgentSetupError('pi-sign-in')
    if (!model) throw new AgentSetupError('pi-model')
    const transport = new HarnessChatTransport(
      sessionId,
      {
        adapter: 'pi',
        sandbox: 'just-bash',
        model,
        settings: {
          ...(runtime.role.profile.thinkingLevel !== 'default' && {
            thinkingLevel: runtime.role.profile.thinkingLevel
          }),
          permissionMode: runtime.role.profile.harnessPermissionMode ?? 'allow-edits'
        },
        instructions: SYSTEM_PROMPT,
        mcpServers: await buildPiMCPServers()
      },
      apiKey
        ? { OPENPENCIL_HARNESS_API_KEY: apiKey }
        : { OPENPENCIL_HARNESS_AGENT_DIR: account?.agentDir ?? '' }
    )
    harnessTransportInstance = transport
    return transport as ChatTransport<UIMessage>
  }

  async function createTransport(
    store: EditorStore,
    diagnosticContext: AIDiagnosticContext,
    role: 'design' | 'fast' = 'design'
  ) {
    if (overrideTransport) return overrideTransport()

    await destroyAgentTransports()

    const runtime = await createAIModelRuntime(role)
    if (runtime?.kind !== 'direct') {
      throw new Error('The Design model is not configured for direct API access')
    }
    return createToolLoopTransport({
      store,
      providerID: runtime.role.connection.providerID,
      model: runtime.model,
      effectiveModelID: resolveLanguageModelID({
        providerID: runtime.role.connection.providerID,
        modelID: runtime.role.profile.modelID,
        customModelID: runtime.role.profile.customModelID
      }),
      maxOutputTokens: runtime.role.profile.maxOutputTokens,
      thinkingLevel: () =>
        role === 'design' ? chatThinkingLevel.value : runtime.role.profile.thinkingLevel,
      onError: captureProviderError,
      diagnosticContext
    })
  }

  async function ensureChat(
    initialMessages?: UIMessage[],
    sessionId = crypto.randomUUID()
  ): Promise<Chat<UIMessage> | null> {
    await credentialsReady
    if (!isConfigured.value) return null

    const store = getActiveEditorStore()
    if (currentChatStore && chat) {
      currentChatMessages.set(currentChatStore, chat.messages)
    }

    if (!chat || transportDirty || currentChatStore !== store) {
      const messages = initialMessages ?? currentChatMessages.get(store)
      const diagnosticContext: AIDiagnosticContext = { sessionId, runId: crypto.randomUUID() }
      const run = createChatRunState()
      const timing = createChatTiming()
      let transport: ChatTransport<UIMessage>
      resetRoutingDecision(store)
      if (LAYA_SUPPORTED && !overrideTransport) {
        transport = createRoutingTransport({
          ...routingOptions(store),
          create: async (role) => {
            const provider = resolveAIModelRole(role)?.connection.providerID
            if (provider?.startsWith('acp:')) return createActiveACPTransport(store, role)
            if (provider === 'harness:pi') return createActiveHarnessTransport(sessionId)
            return createTransport(store, diagnosticContext, role)
          }
        })
      } else if (isACPProvider.value) transport = await createActiveACPTransport(store)
      else if (isHarnessProvider.value) transport = await createActiveHarnessTransport(sessionId)
      else transport = await createTransport(store, diagnosticContext)
      chat = new Chat<UIMessage>({
        transport: {
          sendMessages: async (options) => {
            resetRunTracking(store)
            run.start()
            timing.start()
            diagnosticContext.runId = crypto.randomUUID()
            const stream = await transport.sendMessages(options)
            timing.ready()
            return stream.pipeThrough(
              new TransformStream({
                transform(chunk, controller) {
                  timing.observe(chunk)
                  controller.enqueue(chunk)
                }
              })
            )
          },
          reconnectToStream: (options) => transport.reconnectToStream(options)
        },
        messages,
        onError: (error) => {
          run.fail()
          const reportedError = activeProviderError ?? error
          activeProviderError = null
          failure.value = classifyAIChatError(reportedError)
          const { errorName, errorCode, message, stack } = diagnosticErrorDetails(reportedError)
          recordChatFailed(
            { errorName, errorCode, message, stack, ...timing.snapshot() },
            diagnosticContext
          )
        },
        onFinish: (event) => {
          run.finish(event)
          handleChatFinish(diagnosticContext, timing, event)
        }
      })
      runs.set(chat, run)
      currentChatStore = store
      transportDirty = false
    }
    return chat
  }

  async function resetChat() {
    if (currentChatStore) {
      currentChatMessages.delete(currentChatStore)
      resetRoutingDecision(currentChatStore)
    }
    await destroyAgentTransports()
    failure.value = null
    chat = null
    currentChatStore = null
    transportDirty = false
  }

  function setOverrideTransport(factory: (() => ChatTransport<UIMessage>) | null) {
    overrideTransport = factory
    markTransportDirty()
  }

  const runStateFor = (current: Chat<UIMessage> | null) =>
    current ? (runs.get(current)?.state.value ?? null) : null
  return {
    ensureChat,
    resetChat,
    markTransportDirty,
    setOverrideTransport,
    failure,
    clearFailure,
    runStateFor
  }
}
