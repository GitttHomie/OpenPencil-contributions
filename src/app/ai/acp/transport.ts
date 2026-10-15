import { ClientSideConnection, ndJsonStream, PROTOCOL_VERSION } from '@agentclientprotocol/sdk'
import type {
  Client,
  Agent,
  SessionNotification,
  RequestPermissionRequest,
  RequestPermissionResponse,
  McpServer,
  ContentBlock
} from '@agentclientprotocol/sdk'
import type { ChatTransport, UIMessage, UIMessageChunk } from 'ai'
import { toRaw } from 'vue'

import type { ACPAgentDef } from '@open-pencil/core/constants'

import { MCPStartupError, failureFromError } from '@/app/automation/mcp/failure'
import { describeDiagnosticError, recordACPTransportFailure } from '@/app/diagnostics'
import { buildACPMCPServers } from '@/app/integrations/mcp'
import { MCPConnectionError } from '@/app/integrations/mcp/failure'
import { CredentialStoreError } from '@/app/settings/credentials/types'

import { getACPAgentAdapter } from './adapters/registry'
import { applyCatalogControls } from './configuration/catalog'
import type { ACPIntegration } from './configuration/schema'
import {
  ACPConfigurationError,
  applySessionControls,
  assertSessionControlValues,
  type ACPSessionValues
} from './configuration/session'
import { formatConnectionError } from './connection-error'
import { imagePrompt } from './image-prompt'
import { acpLaunchOptions, ACPLaunchSettingsError, type ACPLaunchSettings } from './launch'
import {
  ACPModelSelectionError,
  applySessionModel,
  sessionModelCatalog,
  updateSessionCatalog,
  type ACPModelCatalog
} from './models'
import { cancelPermissionsForScope, requestPermissionFromUser } from './permission'
import { spawnACPProcess } from './process'
import { buildACPUserPrompt, replayPrompt, isReplayRequest } from './prompt'
import { createACPUpdateStream } from './stream-updates'
import { applySessionThinking, type ACPThinkingSelection } from './thinking'

type TauriChild = Awaited<ReturnType<typeof spawnACPProcess>>['child']

interface ACPSession {
  promptContext?: string
  connection: ClientSideConnection
  sessionId: string
  child: TauriChild
  onUpdate: ((params: SessionNotification) => void) | null
  dead: boolean
  onClose: (() => void) | null
  supportsImages: boolean
  models: ACPModelCatalog
  defaultThinking?: ACPThinkingSelection
  cancelPermissions: () => void
}

type ACPTransportDependencies = {
  spawn: typeof spawnACPProcess
  mcpServers: (chatId?: string, connectionIds?: readonly string[]) => Promise<McpServer[]>
}

const defaultDependencies: ACPTransportDependencies = {
  spawn: spawnACPProcess,
  async mcpServers(chatId, connectionIds) {
    let authorizationToken: string | null
    try {
      const { getAutomationAuthToken } = await import('@/app/automation/mcp/spawn')
      authorizationToken = await getAutomationAuthToken()
    } catch (error) {
      throw new MCPStartupError('The canvas connection is unavailable.', failureFromError(error))
    }
    return buildACPMCPServers({ authorizationToken, chatId, connectionIds })
  }
}

function startupError(error: unknown, agentDef: ACPAgentDef): Error {
  recordACPTransportFailure({ operation: 'start', ...describeDiagnosticError(error) })
  if (
    error instanceof MCPStartupError ||
    error instanceof ACPModelSelectionError ||
    error instanceof MCPConnectionError ||
    error instanceof CredentialStoreError
  )
    return error
  return new Error(formatConnectionError(error, agentDef))
}

export function buildCrashChunks(
  destroying: boolean,
  textId: string,
  textStarted: boolean
): { chunks: UIMessageChunk[]; shouldNullSession: boolean } {
  if (destroying) return { chunks: [], shouldNullSession: false }
  const chunks: UIMessageChunk[] = []
  if (textStarted) chunks.push({ type: 'text-end', id: textId })
  chunks.push({ type: 'error', errorText: 'Agent process exited unexpectedly.' })
  chunks.push({ type: 'finish-step' })
  chunks.push({ type: 'finish', finishReason: 'error' })
  return { chunks, shouldNullSession: true }
}

export class ACPChatTransport implements ChatTransport<UIMessage> {
  private session: ACPSession | null = null
  private agentDef: ACPAgentDef
  private cwd: string
  private sentContext = false
  private lastUserMessage?: UIMessage
  private destroying = false
  private startingChild: TauriChild | null = null
  private startupAbort: AbortController | null = null
  private purpose: 'design' | 'review' | 'vision' | 'catalog' | 'verification'
  private integration?: ACPIntegration
  private sessionValues?: ACPSessionValues
  private launch?: ACPLaunchSettings
  private image?: string
  private images: Array<{ data: string; mimeType: string }>
  private modelId: string
  private catalogDefaultModelId?: string
  private catalogDefaults = new Map<string, ACPSessionValues>()
  private chatId?: string
  private onLog?: (type: string, data: unknown) => void
  private connectionIds?: readonly string[]
  private thinking: () => ACPThinkingSelection | undefined
  private onCatalog?: (catalog: ACPModelCatalog) => void
  private activity?: {
    start(): void
    update(update: SessionNotification['update']): void
    finish(): void
  }

  get imageIncluded(): boolean {
    return Boolean((this.image || this.images.length) && this.session?.supportsImages)
  }

  constructor(
    options: {
      agentDef: ACPAgentDef
      cwd?: string
      purpose?: 'design' | 'review' | 'vision' | 'catalog' | 'verification'
      integration?: ACPIntegration
      sessionValues?: ACPSessionValues
      launch?: ACPLaunchSettings
      image?: string
      images?: Array<{ data: string; mimeType: string }>
      modelId?: string
      chatId?: string
      connectionIds?: readonly string[]
      thinking?: () => ACPThinkingSelection | undefined
      onCatalog?: (catalog: ACPModelCatalog) => void
      activity?: ACPChatTransport['activity']
      onLog?: (type: string, data: unknown) => void
    },
    private dependencies: ACPTransportDependencies = defaultDependencies
  ) {
    this.agentDef = options.agentDef
    this.cwd = options.cwd ?? '.'
    this.purpose = options.purpose ?? 'design'
    this.integration = options.integration ? structuredClone(toRaw(options.integration)) : undefined
    this.sessionValues = options.sessionValues ? { ...options.sessionValues } : undefined
    this.launch = options.launch ? { ...options.launch } : undefined
    this.image = options.image
    this.images = options.images ?? []
    this.modelId = options.modelId ?? ''
    this.chatId = options.chatId
    this.connectionIds = options.connectionIds
    this.thinking = options.thinking ?? (() => undefined)
    this.onCatalog = options.onCatalog
    this.activity = options.activity
    this.onLog = options.onLog
  }

  async listModels(modelId = '', values?: ACPSessionValues): Promise<ACPModelCatalog> {
    this.assertOpen()
    this.session ??= await this.spawnAgent()
    this.catalogDefaultModelId ??= this.session.models.currentModelId
    modelId ||= this.catalogDefaultModelId
    if (modelId && this.session.models.models.some((model) => model.id === modelId)) {
      this.session.models = await applySessionModel(
        this.session.connection,
        this.session.sessionId,
        this.session.models,
        modelId
      )
    }
    this.session.models = await applyCatalogControls(
      this.session.connection,
      this.session.sessionId,
      this.session.models,
      this.catalogDefaults,
      values
    )
    return { ...this.session.models, imageInput: this.session.supportsImages }
  }

  private assertOpen() {
    if (this.destroying) throw new Error('Agent connection was closed.')
  }

  /** Explicit inference probe; never attaches the canvas or the conversation. */
  async verifyModel(probe?: { data: string; expected: string }): Promise<void> {
    if (this.purpose !== 'verification') throw new Error('A verification session is required.')
    this.assertOpen()
    this.session ??= await this.spawnAgent()
    const session = this.session
    if (probe && !session.supportsImages)
      throw new Error('This CLI connection does not accept images.')
    const adapter = getACPAgentAdapter(this.agentDef.id)
    const turn = adapter.createTurn?.()
    let text = ''
    const observation = { usedTools: false }
    session.onUpdate = ({ update }) => {
      turn?.observe(update)
      if (update.sessionUpdate === 'tool_call' && !adapter.isSetupTool?.(update)) {
        observation.usedTools = true
      }
      if (update.sessionUpdate === 'agent_message_chunk' && update.content.type === 'text') {
        text = (text + update.content.text).slice(0, 4096)
      }
    }
    const closed = new Promise<never>((_, reject) => {
      session.onClose = () => reject(new Error('Model verification session closed.'))
    })
    try {
      const requestProbe = async () => {
        await this.applyThinking(session)
        return session.connection.prompt({
          sessionId: session.sessionId,
          prompt: [
            {
              type: 'text',
              text: probe
                ? 'Read the six digits in this image. Reply with only those digits. Do not use tools or read files.'
                : 'Connection test. Reply with exactly OK. Do not use tools, read files, or perform any other task.'
            },
            ...(probe ? [{ type: 'image' as const, data: probe.data, mimeType: 'image/png' }] : [])
          ]
        })
      }
      const response = await Promise.race([requestProbe(), closed])
      this.assertOpen()
      const failure = turn?.failure(response)
      if (failure) throw new Error(failure)
      if (
        response.stopReason !== 'end_turn' ||
        observation.usedTools ||
        !(probe ? text.trim() === probe.expected : /^OK[.!]?$/i.test(text.trim()))
      ) {
        throw new Error('The selected model did not complete the verification request.')
      }
    } finally {
      session.onUpdate = null
      session.onClose = null
    }
  }

  async sendMessages(
    request: Parameters<ChatTransport<UIMessage>['sendMessages']>[0]
  ): Promise<ReadableStream<UIMessageChunk>> {
    this.assertOpen()
    if (this.purpose === 'catalog' || this.purpose === 'verification') {
      throw new Error('Use the dedicated model discovery or verification operation.')
    }
    if (request.abortSignal?.aborted)
      return new ReadableStream({ start: (controller) => controller.close() })
    this.activity?.start()
    const cancelStartup = () => this.activity?.finish()
    request.abortSignal?.addEventListener('abort', cancelStartup, { once: true })
    try {
      return await this.sendPrompt(request)
    } catch (error) {
      this.activity?.finish()
      throw error
    } finally {
      request.abortSignal?.removeEventListener('abort', cancelStartup)
    }
  }

  private async sendPrompt({
    messages,
    abortSignal,
    trigger
  }: Parameters<ChatTransport<UIMessage>['sendMessages']>[0]): Promise<
    ReadableStream<UIMessageChunk>
  > {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')
    const replay = isReplayRequest(trigger, lastUserMessage, this.lastUserMessage)
    // ACP sessions retain their own transcript. Replaying an edited turn needs a fresh
    // session so the CLI does not retain the discarded reply as completed canvas work.
    if (replay && this.session) {
      const previous = this.session
      this.session = null
      previous.cancelPermissions()
      await previous.child.kill()
    }
    const text =
      lastUserMessage?.parts
        .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map((p) => p.text)
        .join('\n') ?? ''

    if (this.session?.dead) {
      this.session = null
    }

    if (!this.session) {
      this.session = await this.spawnAgent()
      this.sentContext = false
    }

    const { connection, sessionId } = this.session
    const session = this.session

    if (abortSignal?.aborted) {
      return new ReadableStream({ start: (controller) => controller.close() })
    }

    await this.applyThinking(session, abortSignal)
    const requestText = replay ? replayPrompt(messages, lastUserMessage, text) : text
    const promptText =
      this.purpose !== 'design'
        ? text
        : buildACPUserPrompt(
            requestText,
            !this.sentContext,
            this.agentDef.id,
            session.promptContext
          )
    const prompt: ContentBlock[] = [{ type: 'text', text: promptText }]
    prompt.push(
      ...imagePrompt(this.purpose, session.supportsImages, lastUserMessage, this.images, this.image)
    )
    this.onLog?.('agent.prompt', {
      agent: this.agentDef.id,
      model: this.modelId,
      prompt,
      thinking: this.thinking()
    })
    this.sentContext = true
    this.lastUserMessage = lastUserMessage ? structuredClone(toRaw(lastUserMessage)) : undefined

    return new ReadableStream<UIMessageChunk>({
      start: (controller) => {
        const activity = this.activity
        const textId = `text-${Date.now()}`
        const updates = createACPUpdateStream(textId)
        const adapterTurn = getACPAgentAdapter(this.agentDef.id).createTurn?.()
        let closed = false

        function finish(reason: 'stop' | 'other' | 'error' | 'length', errorText?: string) {
          if (closed) return
          closed = true
          activity?.finish()
          for (const chunk of updates.finish()) controller.enqueue(chunk)
          if (errorText) controller.enqueue({ type: 'error', errorText })
          controller.enqueue({ type: 'finish-step' })
          controller.enqueue({ type: 'finish', finishReason: reason })
          session.onUpdate = null
          session.onClose = null
          session.cancelPermissions()
          abortSignal?.removeEventListener('abort', cancel)
          controller.close()
        }

        const cancel = () => {
          void connection.cancel({ sessionId }).catch(() => undefined)
          finish('stop')
        }
        session.onClose = () =>
          finish(
            this.destroying ? 'stop' : 'error',
            this.destroying ? undefined : 'Agent process exited unexpectedly.'
          )
        session.onUpdate = (params) => {
          if (closed) return
          adapterTurn?.observe(params.update)
          activity?.update(params.update)
          for (const chunk of updates.map(params.update)) {
            controller.enqueue(chunk)
          }
        }

        abortSignal?.addEventListener('abort', cancel, { once: true })

        controller.enqueue({ type: 'start' })
        controller.enqueue({ type: 'start-step' })

        connection
          .prompt({
            sessionId,
            prompt
          })
          .then((response) => {
            const failure = adapterTurn?.failure(response)
            if (failure) {
              recordACPTransportFailure({
                operation: 'message',
                ...describeDiagnosticError(new Error(failure))
              })
              return finish('error', failure)
            }
            const { stopReason } = response
            if (stopReason === 'end_turn') return finish('stop')
            if (stopReason === 'max_tokens' || stopReason === 'max_turn_requests')
              return finish('length')
            return finish('other')
          })
          .catch((e) => {
            recordACPTransportFailure({
              operation: 'message',
              ...describeDiagnosticError(e)
            })
            finish('error', formatConnectionError(e, this.agentDef))
          })
      }
    })
  }

  private async applyThinking(session: ACPSession, abortSignal?: AbortSignal): Promise<void> {
    const configured = await applySessionControls(
      session.connection,
      session.sessionId,
      session.models.controls ?? [],
      this.sessionValues
    )
    if (configured) session.models = updateSessionCatalog(session.models, configured)
    const defaults = session.defaultThinking
    const fallback =
      session.models.thinking?.options.some((option) => option.value === defaults?.value) &&
      session.models.thinking.id === defaults?.configId
        ? defaults
        : undefined
    const configOptions = await applySessionThinking(
      session.connection,
      session.sessionId,
      session.models.thinking,
      this.thinking() ?? fallback
    )
    this.assertOpen()
    abortSignal?.throwIfAborted()
    if (configOptions) {
      session.models = updateSessionCatalog(session.models, configOptions)
    }
    assertSessionControlValues(session.models.controls ?? [], this.sessionValues)
    if (this.modelId && session.models.currentModelId !== this.modelId) {
      throw new ACPConfigurationError(
        'A CLI option changed the selected model. Refresh its settings and choose compatible options.'
      )
    }
    if (configured || configOptions) this.onCatalog?.(session.models)
  }

  async reconnectToStream(): Promise<ReadableStream<UIMessageChunk> | null> {
    return null
  }

  async destroy(): Promise<void> {
    this.destroying = true
    this.startupAbort?.abort()
    this.activity?.finish()
    const child = this.session?.child ?? this.startingChild
    this.session?.onClose?.()
    this.session?.cancelPermissions()
    this.session = null
    await child?.kill()
  }

  private async spawnAgent(): Promise<ACPSession> {
    this.catalogDefaultModelId = undefined
    this.catalogDefaults.clear()
    let mcpServers: McpServer[]
    try {
      mcpServers =
        this.purpose === 'design'
          ? await this.dependencies.mcpServers(this.chatId, this.connectionIds)
          : []
      this.assertOpen()
    } catch (error) {
      throw startupError(error, this.agentDef)
    }
    const adapter = getACPAgentAdapter(this.agentDef.id)
    const adapterSession = adapter.createSession({ purpose: this.purpose, mcpServers })
    mcpServers = adapterSession.mcpServers ?? mcpServers
    let activeSession: ACPSession | null = null
    let process: Awaited<ReturnType<typeof spawnACPProcess>>
    try {
      const launch = acpLaunchOptions(this.agentDef.id, this.launch, this.integration)
      process = await this.dependencies.spawn({
        command: this.agentDef.command,
        args: [...this.agentDef.args, ...launch.args],
        env: launch.env,
        ...(adapter.isolateMcpOnLaunch
          ? { mcpScope: { cwd: this.cwd, serverNames: mcpServers.map(({ name }) => name) } }
          : {}),
        logId: this.agentDef.id,
        destroying: () => this.destroying,
        onUnexpectedClose: () => {
          if (!activeSession) return
          activeSession.dead = true
          activeSession.onClose?.()
          if (this.session === activeSession) this.session = null
        }
      })
    } catch (e) {
      if (e instanceof ACPLaunchSettingsError) throw e
      recordACPTransportFailure({ operation: 'start', ...describeDiagnosticError(e) })
      throw new Error(formatConnectionError(e, this.agentDef))
    }
    const { child, input, output } = process
    if (this.destroying) {
      await child.kill()
      throw new Error('Agent connection was closed.')
    }
    this.startingChild = child
    const stream = ndJsonStream(input, output)
    let onUpdate: ACPSession['onUpdate'] = null

    const restricted = this.purpose !== 'design'
    const permissionScope = adapterSession.permissions
    const startupAbort = new AbortController()
    this.startupAbort = startupAbort
    const publishCatalog = (catalog: ACPModelCatalog) =>
      this.onCatalog?.({ ...catalog, imageInput: activeSession?.supportsImages })
    const log = this.onLog
    const clientImpl: Client = {
      async requestPermission(
        params: RequestPermissionRequest
      ): Promise<RequestPermissionResponse> {
        if (restricted) return { outcome: { outcome: 'cancelled' } }
        log?.('permission.request', params)
        const response = await requestPermissionFromUser(params, permissionScope)
        log?.('permission.response', { toolCallId: params.toolCall.toolCallId, ...response })
        return response
      },

      async sessionUpdate(params: SessionNotification): Promise<void> {
        if (activeSession && params.sessionId !== activeSession.sessionId) return
        if (adapterSession.normalizeUpdate) {
          params = { ...params, update: adapterSession.normalizeUpdate(params.update) }
        }
        permissionScope.observe(params.update, params.sessionId)
        if (activeSession && params.update.sessionUpdate === 'config_option_update') {
          activeSession.models = updateSessionCatalog(
            activeSession.models,
            params.update.configOptions
          )
          publishCatalog(activeSession.models)
        }
        onUpdate?.(params)
      },

      // Ignore optional notifications; unknown requests retain the SDK error response.
      extNotification: async (method, params) => {
        await adapterSession.notification?.(method, params)
      }
    }

    const connection = new ClientSideConnection((_agent: Agent) => clientImpl, stream)
    try {
      this.assertOpen()
      const initialized = await connection.initialize({
        protocolVersion: PROTOCOL_VERSION,
        clientCapabilities: {}
      })
      const sessionResult = await connection.newSession({
        cwd: this.cwd,
        mcpServers,
        ...(adapterSession.meta ? { _meta: adapterSession.meta } : {})
      })
      this.assertOpen()
      const models = await applySessionModel(
        connection,
        sessionResult.sessionId,
        sessionModelCatalog(sessionResult),
        this.modelId
      )
      await adapterSession.ready?.(sessionResult.sessionId, startupAbort.signal)
      this.assertOpen()

      const session: ACPSession = {
        promptContext: adapterSession.promptContext,
        connection,
        sessionId: sessionResult.sessionId,
        child,
        dead: false,
        onClose: null,
        supportsImages: initialized.agentCapabilities?.promptCapabilities?.image ?? false,
        models,
        defaultThinking: models.thinking
          ? { configId: models.thinking.id, value: models.thinking.currentValue }
          : undefined,
        cancelPermissions: () => cancelPermissionsForScope(permissionScope),
        get onUpdate() {
          return onUpdate
        },
        set onUpdate(fn) {
          onUpdate = fn
        }
      }

      activeSession = session
      publishCatalog(models)
      return session
    } catch (e) {
      cancelPermissionsForScope(permissionScope)
      await child.kill().catch(() => undefined)
      throw startupError(e, this.agentDef)
    } finally {
      this.startingChild = null
      this.startupAbort = null
    }
  }
}
