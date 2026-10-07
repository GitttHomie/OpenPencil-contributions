import {
  AgentSideConnection,
  ndJsonStream,
  PROTOCOL_VERSION,
  type NewSessionRequest,
  type PromptResponse,
  type RequestPermissionResponse,
  type SessionConfigOption,
  type SessionUpdate
} from '@agentclientprotocol/sdk'

import type { ACPAgentDef } from '@open-pencil/core/constants'

import type { ACPModelCatalog } from '@/app/ai/acp/models'
import type { ACPThinkingSelection } from '@/app/ai/acp/thinking'
import { ACPChatTransport } from '@/app/ai/acp/transport'
import { createDeferred } from '@/app/runtime/deferred'

export function createConnectedAgent(
  agentDef: ACPAgentDef,
  waitForCancel = false,
  beforeSpawn?: Promise<void>,
  review = false,
  supportsImages = false,
  modelOptions: {
    modelId?: string
    purpose?: 'catalog' | 'verification'
    responseText?: string
    integration?: ConstructorParameters<typeof ACPChatTransport>[0]['integration']
    sessionValues?: ConstructorParameters<typeof ACPChatTransport>[0]['sessionValues']
    controls?: SessionConfigOption[]
    modelOnControlChange?: string
    launch?: ConstructorParameters<typeof ACPChatTransport>[0]['launch']
    stopReason?: PromptResponse['stopReason']
    thinking?: () => ACPThinkingSelection | undefined
    onCatalog?: (catalog: ACPModelCatalog) => void
    activity?: ConstructorParameters<typeof ACPChatTransport>[0]['activity']
  } = {}
) {
  let toAgent: ReadableStreamDefaultController<Uint8Array> | undefined
  let toClient: ReadableStreamDefaultController<Uint8Array> | undefined
  const agentInput = new ReadableStream<Uint8Array>({
    start(controller) {
      toAgent = controller
    }
  })
  const clientOutput = new ReadableStream<Uint8Array>({
    start(controller) {
      toClient = controller
    }
  })
  const agentOutput = new WritableStream<Uint8Array>({
    write(chunk) {
      toClient?.enqueue(chunk)
    }
  })
  const clientInput = new WritableStream<Uint8Array>({
    write(chunk) {
      toAgent?.enqueue(chunk)
    }
  })
  const completion = createDeferred<PromptResponse>()
  const started = createDeferred<undefined>()
  const spawning = createDeferred<undefined>()
  const sessions: NewSessionRequest[] = []
  const prompts: string[] = []
  const images: string[] = []
  const permissions: RequestPermissionResponse[] = []
  const modelEvents: string[] = []
  let activeModel = 'strong'
  let activeThinking = 'balanced'
  const customControls = structuredClone(modelOptions.controls ?? [])
  const configOptions = (): SessionConfigOption[] => [
    ...customControls,
    {
      id: 'model',
      name: 'Model',
      category: 'model',
      type: 'select',
      currentValue: activeModel,
      options: [
        { value: 'strong', name: 'Strong' },
        { value: 'fast', name: 'Fast' }
      ]
    },
    ...(modelOptions.thinking
      ? [
          {
            id: 'reasoning',
            name: 'Reasoning',
            category: 'thought_level',
            type: 'select' as const,
            currentValue: activeThinking,
            options: [
              { value: 'balanced', name: 'Balanced' },
              { value: 'deep', name: 'Deep' }
            ]
          }
        ]
      : [])
  ]
  let cancelled = 0
  let closed = false
  let unexpectedClose = () => undefined
  const child = {
    pid: 1,
    async write() {
      throw new Error('The fake ACP process uses byte streams directly.')
    },
    async kill() {
      if (closed) return
      closed = true
      toAgent?.close()
      toClient?.close()
    }
  }
  const connection = new AgentSideConnection(
    (client) => ({
      initialize: async () => ({
        protocolVersion: PROTOCOL_VERSION,
        agentCapabilities: { promptCapabilities: { image: supportsImages } }
      }),
      newSession: async (request) => {
        sessions.push(request)
        await client.extNotification('_kiro/mcp/status', {
          sessionId: 'session-test',
          servers: [{ name: 'open-pencil', status: 'connected' }]
        })
        return { sessionId: 'session-test', configOptions: configOptions() }
      },
      setSessionConfigOption: async (request) => {
        const custom = customControls.find((control) => control.id === request.configId)
        if (custom) {
          custom.currentValue = request.value
          if (modelOptions.modelOnControlChange) activeModel = modelOptions.modelOnControlChange
          modelEvents.push(`option:${custom.id}:${request.value}`)
          return { configOptions: configOptions() }
        }
        if (request.configId === 'reasoning') {
          activeThinking = request.value
          modelEvents.push(`thinking:${activeThinking}`)
          return { configOptions: configOptions() }
        }
        activeModel = request.value
        modelEvents.push(`select:${activeModel}`)
        return { configOptions: configOptions() }
      },
      authenticate: async () => ({}),
      prompt: async ({ sessionId, prompt }) => {
        modelEvents.push(`prompt:${activeModel}`)
        if (modelOptions.thinking) modelEvents.push(`prompt-thinking:${activeThinking}`)
        prompts.push(prompt.flatMap((part) => (part.type === 'text' ? [part.text] : [])).join('\n'))
        images.push(...prompt.flatMap((part) => (part.type === 'image' ? [part.data] : [])))
        if (review) {
          permissions.push(
            await client.requestPermission({
              sessionId,
              toolCall: { toolCallId: 'edit', title: 'Edit design' },
              options: [{ optionId: 'allow', name: 'Allow', kind: 'allow_once' }]
            })
          )
        }
        await client.extNotification('_kiro/mcp/status', { sessionId, servers: [] })
        await client.sessionUpdate({
          sessionId,
          update: {
            sessionUpdate: 'agent_message_chunk',
            content: { type: 'text', text: modelOptions.responseText ?? 'Done' }
          }
        })
        started.resolve(undefined)
        return waitForCancel
          ? completion.promise
          : { stopReason: modelOptions.stopReason ?? 'end_turn' }
      },
      cancel: async () => {
        cancelled++
        completion.resolve({ stopReason: 'cancelled' })
      }
    }),
    ndJsonStream(agentOutput, agentInput)
  )
  const transport = new ACPChatTransport(
    {
      agentDef,
      cwd: '/workspace',
      purpose: modelOptions.purpose ?? (review ? 'review' : 'design'),
      launch: modelOptions.launch,
      integration: modelOptions.integration,
      sessionValues: modelOptions.sessionValues,
      modelId: modelOptions.modelId,
      thinking: modelOptions.thinking,
      onCatalog: modelOptions.onCatalog,
      activity: modelOptions.activity,
      image: review ? 'AQID' : undefined
    },
    {
      spawn: async (options) => {
        spawning.resolve(undefined)
        await beforeSpawn
        unexpectedClose = options.onUnexpectedClose
        return { child, input: clientInput, output: clientOutput }
      },
      mcpServers: async () => [
        {
          type: 'http',
          name: 'open-pencil',
          url: 'http://127.0.0.1:7600/mcp',
          headers: [{ name: 'Authorization', value: 'Bearer test-token' }]
        }
      ]
    }
  )
  return {
    transport,
    sessions,
    prompts,
    images,
    permissions,
    modelEvents,
    started: started.promise,
    spawning: spawning.promise,
    cancelled: () => cancelled,
    closed: () => closed,
    notify: (update: SessionUpdate) =>
      connection.sessionUpdate({ sessionId: 'session-test', update }),
    async crash() {
      unexpectedClose()
      await child.kill()
    },
    async dispose() {
      await transport.destroy()
      await connection.closed
    }
  }
}
