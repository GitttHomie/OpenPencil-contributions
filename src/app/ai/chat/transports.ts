import { Chat } from '@ai-sdk/vue'
import { useEventListener } from '@vueuse/core'
import { createUIMessageStream, DirectChatTransport, stepCountIs, ToolLoopAgent } from 'ai'
import type {
  ChatTransport,
  FinishReason,
  LanguageModel,
  ToolExecutionOptions,
  UIMessage,
  ToolSet
} from 'ai'
import type { ComputedRef, Ref } from 'vue'
import { ref } from 'vue'

import { ACP_AGENTS } from '@open-pencil/core/constants'
import type { ACPAgentID, AIProviderID } from '@open-pencil/core/constants'
import { AI_PROVIDERS } from '@open-pencil/feedback/contract'

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
import { createDesignCheckCycle } from '@/app/ai/design-checks/cycle'
import { designCheckSettings } from '@/app/ai/design-checks/preferences'
import { designCheckState } from '@/app/ai/design-checks/state'
import { withDesignChecks } from '@/app/ai/design-checks/transport'
import {
  createAIModelRuntime,
  resolveAIModelRole,
  resolveModelConnectionAPIKey
} from '@/app/ai/models'
import type { ThinkingLevel } from '@/app/ai/models/types'
import { createRunPreview } from '@/app/ai/preview/run'
import { LAYA_SUPPORTED } from '@/app/ai/routing/preferences'
import { resetRoutingDecision, routingOptions } from '@/app/ai/routing/session'
import { createRoutingTransport } from '@/app/ai/routing/transport'
import { createAITools, currentRun, endRun, recordStep, startRun } from '@/app/ai/tools'
import { enabledAIToolDefinitions } from '@/app/ai/tools/catalog'
import { aiToolOverrides } from '@/app/ai/tools/preferences'
import { resetRunTracking } from '@/app/ai/tools/run'
import { restAgents } from '@/app/automation/agents'
import { diagnosticErrorDetails } from '@/app/diagnostics'
import {
  recordChatCompleted,
  recordChatFailed,
  recordChatStopped,
  recordModelStepCompleted
} from '@/app/diagnostics/events'
import type { AIDiagnosticContext } from '@/app/diagnostics/events/ai'
import type { getActiveEditorStore } from '@/app/editor/active-store'
import { createExternalMCPTools } from '@/app/integrations/mcp/tools'
import { trackUsage } from '@/app/telemetry'

import { resumableTransport } from './history/continuation'
import { createTraceStore } from './history/idb'
import { sessionLogRequest, sessionLogStatus } from './logging/request'
import { startSessionLog, recordSessionEvent } from './logging/service'
import { updateMessage } from './metadata'
import { maxAgentSteps } from './preferences'
import { createChatRunState } from './run-state'
import { settleMessage } from './settle'
import { createChatTiming } from './timing'
import { createRunRecorder } from './trace/recorder'
import type { RunRecorder, RunRecording } from './trace/recorder'

type EditorStore = ReturnType<typeof getActiveEditorStore>

type ChatSessionOptions = {
  isConfigured: ComputedRef<boolean>
  isACPProvider: ComputedRef<boolean>
  isHarnessProvider: ComputedRef<boolean>
  providerID: Ref<AIProviderID>
  credentialsReady: Promise<void>
  getActiveEditorStore: () => EditorStore
  connectionIds?: () => readonly string[]
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
  externalTools?: ToolSet
  /** Records each run so a saved trace can rebuild its requests. */
  recorder?: RunRecorder
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
    | 'thinking'
    | 'onCatalog'
    | 'activity'
    | 'chatId'
    | 'launch'
    | 'integration'
    | 'sessionValues'
    | 'connectionIds'
    | 'onLog'
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
  diagnosticContext = {},
  externalTools = {},
  recorder
}: ToolLoopTransportOptions) {
  const tools = { ...createAITools(store, diagnosticContext), ...externalTools }
  // The reply in progress; a transport sends one message at a time.
  let run = currentRun(store)
  // While JSX streams, the chat's agent moves through the elements as they appear, here and
  // on the screens of everyone else in the room.
  const preview = createRunPreview(store)
  const renderTool = tools.render
  renderTool.onInputStart = ({ toolCallId, abortSignal }) => preview.start(toolCallId, abortSignal)
  renderTool.onInputDelta = ({ toolCallId, inputTextDelta }) =>
    preview.delta(toolCallId, inputTextDelta)
  renderTool.onInputAvailable = ({ toolCallId }: ToolExecutionOptions<unknown>) =>
    preview.finish(toolCallId)
  const cacheProviderOptions = supportsAnthropicCaching(providerID, effectiveModelID)
    ? ANTHROPIC_CACHE_CONTROL
    : undefined
  let recording: RunRecording | undefined
  const agent = new ToolLoopAgent({
    model,
    instructions: SYSTEM_PROMPT,
    tools,
    maxOutputTokens,
    // Kept only to fingerprint each step's request for its trace.
    include: { requestMessages: recorder !== undefined },
    prepareCall: (options) => {
      const enabledNames = new Set([
        ...enabledAIToolDefinitions(aiToolOverrides.value).map((tool) => tool.name),
        ...Object.keys(externalTools)
      ])
      preview.clear()
      // Keep the full catalog for validating history; offer only enabled tools to this request.
      const offered = Object.fromEntries(
        Object.entries(tools).filter(([name]) => enabledNames.has(name))
      )
      recording?.offer(offered)
      return {
        ...options,
        stopWhen: stepCountIs(
          Math.max(1, currentRun(store).maxSteps - currentRun(store).currentSteps)
        ),
        // Keep the full catalog for validating history; offer only enabled tools to this request.
        tools: offered,
        maxOutputTokens,
        ...callSettings(providerID, cacheProviderOptions, thinkingLevel())
      }
    },
    onFinish: () => {
      preview.clear()
      endRun(store, run)
      recording?.end('completed')
    },
    onStepFinish: (step) => {
      const { usage } = step
      recordSessionEvent(diagnosticContext.runId, 'model.usage', {
        provider: providerID,
        model: effectiveModelID,
        usage
      })
      preview.clear()
      recordStep(store)
      recording?.step(step)
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
    endRun(store, run)
    recording?.fail(error)
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
      // The run starts as the message is sent, so a Stop before the model is reached ends it.
      const continuation = designCheckState(store).continuing ? currentRun(store) : undefined
      const started = startRun(store, maxAgentSteps.value, effectiveModelID, continuation)
      run = started
      const { sessionId, runId } = diagnosticContext
      const startedRecording =
        sessionId && runId
          ? recorder?.start({
              conversationId: sessionId,
              runId,
              model: { provider: providerID, id: effectiveModelID },
              settings: {
                maxOutputTokens,
                maxSteps: started.maxSteps,
                thinking: thinkingLevel(),
                cache: cacheProviderOptions !== undefined
              },
              instructions: SYSTEM_PROMPT,
              messages: options.messages
            })
          : undefined
      recording = startedRecording
      // Stopping a reply ends the run without onFinish.
      const stop = () => {
        endRun(store, started)
        startedRecording?.end('stopped')
      }
      const { abortSignal } = options
      if (abortSignal?.aborted) stop()
      else if (abortSignal) useEventListener(abortSignal, 'abort', stop)
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

/**
 * A reply that ended unfinished is settled once its last edit landed, so it no longer reads as
 * running and the model learns which of its calls changed the document.
 */
async function settleEndedReply(
  chat: Chat<UIMessage>,
  store: EditorStore,
  messageId: string,
  stopped: boolean
): Promise<void> {
  const run = currentRun(store)
  await run.settled()
  updateMessage(chat, messageId, (message) =>
    settleMessage(message, { stopped, changed: (toolCallId) => run.changedCalls.has(toolCallId) })
  )
}

export function createChatSessionManager({
  providerID,
  isConfigured,
  isACPProvider,
  isHarnessProvider,
  credentialsReady,
  getActiveEditorStore,
  connectionIds = () => []
}: ChatSessionOptions) {
  const failure = ref<AIChatFailure | null>(null)
  let transportDirty = false
  let currentChatStore: EditorStore | null = null
  const currentChatMessages = new WeakMap<EditorStore, UIMessage[]>()
  let chat: Chat<UIMessage> | null = null
  let acpTransportInstance: { destroy(): Promise<void> } | null = null
  let harnessTransportInstance: { stop(): Promise<void> } | null = null
  let externalMCP: Awaited<ReturnType<typeof createExternalMCPTools>> | null = null
  let overrideTransport: (() => ChatTransport<UIMessage>) | null = null
  let activeProviderError: unknown = null
  const runs = new WeakMap<Chat<UIMessage>, ReturnType<typeof createChatRunState>>()
  const runRecorder = createRunRecorder(createTraceStore())

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
    if (isAbort) recordChatStopped(context)
    else if (!isDisconnect && !isError) {
      recordChatCompleted({ finishReason: finishReason ?? null, ...timing.snapshot() }, context)
      const provider = AI_PROVIDERS.find((id) => id === providerID.value)
      if (provider) trackUsage({ name: 'ai_reply_finished', provider })
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
    const external = externalMCP
    externalMCP = null
    acpTransportInstance = null
    harnessTransportInstance = null
    const results = await Promise.allSettled([acp?.destroy(), harness?.stop(), external?.close()])
    const errors = results
      .filter((result) => result.status === 'rejected')
      .map((result) => result.reason)
    if (errors.length) throw new AggregateError(errors, 'Agent transport teardown failed')
  }

  async function createActiveACPTransport(
    store: EditorStore,
    context: AIDiagnosticContext,
    role: 'design' | 'fast' = 'design'
  ) {
    await destroyAgentTransports()
    await assertAgentReady('acp')
    const runtime = await createAIModelRuntime(role)
    if (runtime?.kind !== 'acp') throw new Error('The Design model is not a CLI profile')
    designCheckState(store).supportsImages = false
    const thinking = role === 'design' ? acpChatThinkingState(store, runtime.role.profile) : null
    const model = runtime.role.profile.customModelID || runtime.role.profile.modelID
    const canvas = createCanvasSession(store)
    const activity = createACPCanvasActivity(store, model || runtime.role.profile.name)
    try {
      const transport = await createACPTransport(runtime.role.connection.providerID, model, {
        chatId: canvas.id,
        connectionIds: [...connectionIds()],
        onLog: (type, data) => recordSessionEvent(context.runId, type, data),
        launch: runtime.role.profile.acpLaunch,
        integration: runtime.role.profile.acpIntegration,
        sessionValues: runtime.role.profile.acpOptions,
        thinking: () => (thinking ? thinking.choice.value : runtime.role.profile.acpThinking),
        onCatalog: (catalog) => {
          thinking?.publish(catalog)
          designCheckState(store).supportsImages = catalog.imageInput === true
        },
        activity: {
          start() {
            canvas.start(designCheckState(store).continuing)
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

  async function createActiveHarnessTransport(store: EditorStore, sessionId: string) {
    designCheckState(store).supportsImages = false
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
        mcpServers: await buildPiMCPServers({ connectionIds: [...connectionIds()] })
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
    externalMCP = await createExternalMCPTools([...connectionIds()], undefined, (type, data) =>
      recordSessionEvent(diagnosticContext.runId, type, data)
    )
    designCheckState(store).supportsImages = runtime.role.profile.capabilities.includes('vision')
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
      diagnosticContext,
      externalTools: externalMCP.tools,
      recorder: runRecorder
    })
  }

  async function ensureChat(
    initialMessages?: UIMessage[],
    sessionId = crypto.randomUUID()
  ): Promise<Chat<UIMessage> | null> {
    await credentialsReady
    if (!isConfigured.value) return null

    const store = getActiveEditorStore()
    // Settings changes affect the next run, never replace a live transport.
    if (chat?.status === 'submitted' || chat?.status === 'streaming') return chat
    if (currentChatStore && chat) {
      currentChatMessages.set(currentChatStore, chat.messages)
    }

    if (!chat || transportDirty || currentChatStore !== store) {
      const messages = initialMessages ?? currentChatMessages.get(store)
      const diagnosticContext: AIDiagnosticContext = { sessionId, runId: crypto.randomUUID() }
      const run = createChatRunState()
      const timing = createChatTiming()
      let transport: ChatTransport<UIMessage>
      const agentKind = isACPProvider.value ? 'acp' : null
      const harnessRun = isHarnessProvider.value
      resetRoutingDecision(store)
      if (LAYA_SUPPORTED && !overrideTransport) {
        transport = createRoutingTransport({
          ...routingOptions(store),
          create: async (role) => {
            const provider = resolveAIModelRole(role)?.connection.providerID
            recordSessionEvent(diagnosticContext.runId, 'routing.selected', { role, provider })
            if (provider?.startsWith('acp:'))
              return createActiveACPTransport(store, diagnosticContext, role)
            if (provider === 'harness:pi') return createActiveHarnessTransport(store, sessionId)
            return createTransport(store, diagnosticContext, role)
          }
        })
      } else if (isACPProvider.value)
        transport = await createActiveACPTransport(store, diagnosticContext)
      else if (isHarnessProvider.value)
        transport = await createActiveHarnessTransport(store, sessionId)
      else transport = await createTransport(store, diagnosticContext)
      transport = withDesignChecks(transport, {
        settings: () => designCheckSettings.value,
        start: () => createDesignCheckCycle(store)
      })
      let sessionLog: ReturnType<typeof startSessionLog> = null
      const created: Chat<UIMessage> = new Chat<UIMessage>({
        transport: {
          sendMessages: async (options) => {
            resetRunTracking(store)
            run.start()
            timing.start()
            diagnosticContext.runId = crypto.randomUUID()
            const requestLog = startSessionLog(
              sessionId,
              diagnosticContext.runId,
              sessionLogRequest(options.messages, options.trigger, connectionIds())
            )
            sessionLog = requestLog
            let stream
            try {
              stream = await transport.sendMessages(options)
            } catch (error) {
              sessionLog?.record(
                'request.error',
                error instanceof Error
                  ? { name: error.name, message: error.message }
                  : String(error)
              )
              requestLog?.finish(
                options.abortSignal?.aborted ? 'stopped' : 'failed',
                timing.snapshot()
              )
              throw error
            }
            timing.ready()
            return stream.pipeThrough(
              new TransformStream({
                transform(chunk, controller) {
                  timing.observe(chunk)
                  requestLog?.observe(chunk)
                  controller.enqueue(chunk)
                }
              })
            )
          },
          reconnectToStream: (options) => transport.reconnectToStream(options)
        },
        messages,
        onError: (error) => {
          sessionLog?.record('request.error', { name: error.name, message: error.message })
          sessionLog?.finish('failed', timing.snapshot())
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
          sessionLog?.finish(sessionLogStatus(event), {
            finishReason: event.finishReason,
            ...timing.snapshot()
          })
          run.finish(event)
          handleChatFinish(diagnosticContext, timing, event)
          if (agentKind) restAgents(agentKind)
          if (harnessRun) restAgents('harness')
          if (event.isAbort || event.isDisconnect || event.isError) {
            void settleEndedReply(created, store, event.message.id, event.isAbort)
          }
        }
      })
      chat = created
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
