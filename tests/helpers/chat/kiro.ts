import type { SessionUpdate } from '@agentclientprotocol/sdk'
import type { Page } from '@playwright/test'
import type { UIMessageChunk } from 'ai'

import type * as CanvasPermissionsModule from '@/app/ai/acp/canvas-permissions'
import type * as PermissionModule from '@/app/ai/acp/permission'
import type * as StreamUpdatesModule from '@/app/ai/acp/stream-updates'

export async function installKiroPermissionTransport(page: Page) {
  await page.evaluate(async () => {
    const streamPath = '/src/app/ai/acp/stream-updates.ts'
    const permissionsPath = '/src/app/ai/acp/permission.ts'
    const scopePath = '/src/app/ai/acp/canvas-permissions.ts'
    const { createACPUpdateStream } = (await import(streamPath)) as typeof StreamUpdatesModule
    const { requestPermissionFromUser, cancelPermissionsForScope } = (await import(
      permissionsPath
    )) as typeof PermissionModule
    const { createCanvasPermissionScope } = (await import(
      scopePath
    )) as typeof CanvasPermissionsModule
    const setTransport = window.openPencil?.setChatTransport
    if (!setTransport) throw new Error('Chat transport unavailable')
    setTransport(() => ({
      async sendMessages() {
        const updates = createACPUpdateStream('kiro-test')
        const scope = createCanvasPermissionScope(true)
        return new ReadableStream<UIMessageChunk>({
          async start(controller) {
            const emit = (update: SessionUpdate) => {
              scope.observe(update, 'kiro-test')
              for (const chunk of updates.map(update)) controller.enqueue(chunk)
            }
            controller.enqueue({ type: 'start' })
            controller.enqueue({ type: 'start-step' })
            for (const text of ['Checking ', 'the ', 'canvas.']) {
              emit({ sessionUpdate: 'agent_thought_chunk', content: { type: 'text', text } })
            }
            emit({
              sessionUpdate: 'tool_call_update',
              toolCallId: 'powers',
              title: 'Kiro Powers',
              status: 'completed',
              rawInput: { action: 'list' },
              rawOutput: { powers: [] }
            })
            try {
              for (const name of ['get_selection', 'update_node', 'shell']) {
                const title = name === 'shell' ? 'Run shell command' : `@open-pencil/${name}`
                emit({
                  sessionUpdate: 'tool_call',
                  toolCallId: name,
                  title,
                  status: 'pending',
                  rawInput: { tool_id: `open-pencil::${name}`, arguments: {} },
                  _meta: { kiro: { serverName: name === 'shell' ? 'builtin' : 'open-pencil' } }
                })
                const response = await requestPermissionFromUser(
                  {
                    sessionId: 'kiro-test',
                    toolCall: { toolCallId: name, title, status: 'pending' },
                    options: [
                      { optionId: 'accept', kind: 'allow_once', name: 'Allow' },
                      { optionId: 'reject', kind: 'reject_once', name: 'Deny' }
                    ]
                  },
                  scope
                )
                const allowed =
                  response.outcome.outcome === 'selected' && response.outcome.optionId === 'accept'
                emit({
                  sessionUpdate: 'tool_call_update',
                  toolCallId: name,
                  status: allowed ? 'completed' : 'failed',
                  rawOutput: { allowed }
                })
              }
              emit({
                sessionUpdate: 'agent_message_chunk',
                content: { type: 'text', text: 'Permission flow complete.' }
              })
              for (const chunk of updates.finish()) controller.enqueue(chunk)
              controller.enqueue({ type: 'finish-step' })
              controller.enqueue({ type: 'finish', finishReason: 'stop' })
              controller.close()
            } finally {
              cancelPermissionsForScope(scope)
            }
          }
        })
      },
      async reconnectToStream() {
        return null
      }
    }))
  })
}
