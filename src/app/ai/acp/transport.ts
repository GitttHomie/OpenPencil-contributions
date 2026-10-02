import { ClientSideConnection, ndJsonStream, PROTOCOL_VERSION } from '@agentclientprotocol/sdk'
import type {
  Client,
  Agent,
  SessionNotification,
  RequestPermissionRequest,
  RequestPermissionResponse,
  McpServer
} from '@agentclientprotocol/sdk'
import type { ChatTransport, UIMessage, UIMessageChunk } from 'ai'

import type { ACPAgentDef } from '@open-pencil/core/constants'

import { MCPStartupError, failureFromError } from '@/app/automation/mcp/failure'
import { describeDiagnosticError, recordACPTransportFailure } from '@/app/diagnostics'
import { buildACPMCPServers } from '@/app/integrations/mcp'

import { mapUpdate } from './map-update'
import { spawnACPProcess } from './process'
import { buildACPUserPrompt } from './prompt'

type TauriChild = Awaited<ReturnType<typeof spawnACPProcess>>['child']

interface ACPSession {
  connection: ClientSideConnection
  sessionId: string
  child: TauriChild
  onUpdate: ((params: SessionNotification) => void) | null
  dead: boolean
  onClose: (() => void) | null
}

type ACPTransportDependencies = {
  spawn: typeof spawnACPProcess
  mcpServers: () => Promise<McpServer[]>
}

const defaultDependencies: ACPTransportDependencies = {
  spawn: spawnACPProcess,
  async mcpServers() {
    try {
      const { getAutomationAuthToken } = await import('@/app/automation/mcp/spawn')
      return await buildACPMCPServers({ authorizationToken: await getAutomationAuthToken() })
    } catch (error) {
      throw new MCPStartupError('The canvas connection is unavailable.', failureFromError(error))
    }
  }
}

function isMissingCommandError(message: string): boolean {
  const normalized = message.toLowerCase()
  return normalized.includes('enoent') || normalized.includes('program not found')
}

function missingCommandMessage(agentDef?: ACPAgentDef): string {
  if (!agentDef) return 'ACP agent CLI is not installed.'
  if (!agentDef.installCommand) {
    return `"${agentDef.command}" is not installed. Install it and restart OpenPencil.`
  }
  return `"${agentDef.command}" is not installed. Install it with: ${agentDef.installCommand}`
}

export function formatConnectionError(e: unknown, agentDef?: ACPAgentDef): string {
  const msg = e instanceof Error ? e.message : String(e)
  if (
    msg.includes('ECONNREFUSED') ||
    msg.includes('fetch failed') ||
    msg.includes('Failed to fetch')
  ) {
    return 'MCP server is not running. Make sure the editor is open.'
  }
  if (msg.includes('timeout') || msg.includes('Timeout') || msg.includes('ETIMEDOUT')) {
    return 'MCP server did not respond in time.'
  }
  if (isMissingCommandError(msg)) {
    return missingCommandMessage(agentDef)
  }
  return msg
}

function startupError(error: unknown, agentDef: ACPAgentDef): Error {
  recordACPTransportFailure({ operation: 'start', ...describeDiagnosticError(error) })
  if (error instanceof MCPStartupError) return error
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
  private destroying = false
  private startingChild: TauriChild | null = null

  constructor(
    options: { agentDef: ACPAgentDef; cwd?: string },
    private dependencies: ACPTransportDependencies = defaultDependencies
  ) {
    this.agentDef = options.agentDef
    this.cwd = options.cwd ?? '.'
  }

  private assertOpen() {
    if (this.destroying) throw new Error('Agent connection was closed.')
  }

  async sendMessages({
    messages,
    abortSignal
  }: Parameters<ChatTransport<UIMessage>['sendMessages']>[0]): Promise<
    ReadableStream<UIMessageChunk>
  > {
    this.assertOpen()
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')
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

    const promptText = buildACPUserPrompt(text, !this.sentContext)
    this.sentContext = true

    return new ReadableStream<UIMessageChunk>({
      start: (controller) => {
        const textId = `text-${Date.now()}`
        let textStarted = false
        let closed = false

        function finish(reason: 'stop' | 'other' | 'error', errorText?: string) {
          if (closed) return
          closed = true
          if (errorText) controller.enqueue({ type: 'error', errorText })
          if (textStarted) controller.enqueue({ type: 'text-end', id: textId })
          controller.enqueue({ type: 'finish-step' })
          controller.enqueue({ type: 'finish', finishReason: reason })
          session.onUpdate = null
          session.onClose = null
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
          const result = mapUpdate(params.update, textId, textStarted)
          for (const chunk of result.chunks) {
            controller.enqueue(chunk)
          }
          textStarted = result.textStarted
        }

        abortSignal?.addEventListener('abort', cancel, { once: true })

        controller.enqueue({ type: 'start' })
        controller.enqueue({ type: 'start-step' })

        connection
          .prompt({
            sessionId,
            prompt: [{ type: 'text', text: promptText }]
          })
          .then(({ stopReason }) =>
            finish(stopReason === 'end_turn' || stopReason === 'cancelled' ? 'stop' : 'other')
          )
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

  async reconnectToStream(): Promise<ReadableStream<UIMessageChunk> | null> {
    return null
  }

  async destroy(): Promise<void> {
    this.destroying = true
    const child = this.session?.child ?? this.startingChild
    this.session?.onClose?.()
    this.session = null
    await child?.kill()
  }

  private async spawnAgent(): Promise<ACPSession> {
    let mcpServers: McpServer[]
    try {
      mcpServers = await this.dependencies.mcpServers()
      this.assertOpen()
    } catch (error) {
      throw startupError(error, this.agentDef)
    }
    let activeSession: ACPSession | null = null
    let process: Awaited<ReturnType<typeof spawnACPProcess>>
    try {
      process = await this.dependencies.spawn({
        command: this.agentDef.command,
        args: this.agentDef.args,
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

    const clientImpl: Client = {
      async requestPermission(
        params: RequestPermissionRequest
      ): Promise<RequestPermissionResponse> {
        const { requestPermissionFromUser } = await import('@/app/ai/acp/permission')
        return requestPermissionFromUser(params)
      },

      async sessionUpdate(params: SessionNotification): Promise<void> {
        onUpdate?.(params)
      },

      // Agents may advertise optional status notifications we do not render.
      // Unknown requests still receive the SDK's method-not-found response.
      extNotification: async () => undefined
    }

    const connection = new ClientSideConnection((_agent: Agent) => clientImpl, stream)
    try {
      this.assertOpen()
      await connection.initialize({
        protocolVersion: PROTOCOL_VERSION,
        clientCapabilities: {}
      })
      const sessionResult = await connection.newSession({
        cwd: this.cwd,
        mcpServers
      })
      this.assertOpen()

      const session: ACPSession = {
        connection,
        sessionId: sessionResult.sessionId,
        child,
        dead: false,
        onClose: null,
        get onUpdate() {
          return onUpdate
        },
        set onUpdate(fn) {
          onUpdate = fn
        }
      }

      activeSession = session
      return session
    } catch (e) {
      await child.kill().catch(() => undefined)
      throw startupError(e, this.agentDef)
    } finally {
      this.startingChild = null
    }
  }
}
