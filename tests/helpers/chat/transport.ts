import type { Page } from '@playwright/test'

export async function injectMockChatTransport(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const failurePath = '/src/app/automation/mcp/failure.ts'
    const { MCPStartupError } = await import(failurePath)
    const setChatTransport = window.openPencil?.setChatTransport
    if (!setChatTransport) throw new Error('Transport override not available')
    let messageCounter = 0
    let flakyFailed = false

    setChatTransport(() => ({
      async sendMessages({
        messages
      }: {
        messages: Array<{ role: string; parts: Array<{ type: string; text?: string }> }>
      }) {
        const lastUser = [...messages].reverse().find((message) => message.role === 'user')
        const text = lastUser?.parts?.find((part) => part.type === 'text')?.text ?? ''
        const messageId = `mock-msg-${++messageCounter}`
        const normalized = text.toLowerCase()
        document.documentElement.dataset.lastChatRequest = text
        const tool = normalized.includes('frame') || normalized.includes('rectangle')
        const code = normalized.includes('code block')
        const unsafeMarkdown = normalized.includes('unsafe markdown')
        const multipleParts = normalized.includes('multiple parts')
        const reasoning = normalized.includes('reasoning')

        if (normalized.includes('expired key')) {
          return new ReadableStream({
            start(controller) {
              controller.enqueue({ type: 'error', errorText: 'API key expired.' })
              controller.close()
            }
          })
        }
        if (normalized.includes('missing agent')) {
          throw new Error('Mock agent unavailable')
        }
        if (normalized.includes('missing canvas')) {
          throw new MCPStartupError('MCP automation is not installed.', { code: 'not-installed' })
        }
        // Fails the first time only, before any reply, as a dropped connection does.
        if (normalized.includes('flaky request') && !flakyFailed) {
          flakyFailed = true
          throw new Error('Mock connection dropped')
        }

        // Streams 40 lines (2 for a short one), waits for a `mock-chat-continue` event on window,
        // then streams 40 more, so a test can scroll while no output arrives.
        if (normalized.includes('paused stream') || normalized.includes('paused short stream')) {
          const beforePause = normalized.includes('short') ? 2 : 40
          return new ReadableStream({
            start(controller) {
              controller.enqueue({ type: 'start', messageId })
              controller.enqueue({ type: 'text-start', id: 'text-1' })
              let line = 0
              const streamLines = (until: number, done: () => void) => {
                const timer = setInterval(() => {
                  controller.enqueue({
                    type: 'text-delta',
                    id: 'text-1',
                    delta: `Line ${line}\n\n`
                  })
                  if (++line < until) return
                  clearInterval(timer)
                  done()
                }, 20)
              }
              streamLines(beforePause, () => {
                window.addEventListener(
                  'mock-chat-continue',
                  () =>
                    streamLines(beforePause + 40, () => {
                      controller.enqueue({ type: 'text-end', id: 'text-1' })
                      controller.enqueue({ type: 'finish', finishReason: 'stop' })
                      controller.close()
                    }),
                  { once: true }
                )
              })
            }
          })
        }

        return new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'start', messageId })
            if (normalized.includes('codex tool results')) enqueueCodexTools(controller)
            if (normalized.includes('image tool result')) enqueueImageTool(controller)
            if (tool) enqueueToolCall(controller, messageId)
            if (reasoning) enqueueReasoning(controller)
            if (multipleParts) {
              enqueueMultipleTextParts(controller)
              return
            }
            let response = `I'll help you with: "${text}". Here's a mock response.`
            if (tool) response = 'Created a frame called "Card".'
            else if (unsafeMarkdown) {
              response = `[unsafe](javascript:alert(1)) ![embedded](data:image/svg+xml,<svg onload=alert(1)></svg>) ![approved](${window.location.origin}/assets/approved.png) ![unapproved](https://example.com/unapproved.png) ![insecure](http://example.com/insecure.png) [safe](https://openpencil.dev)`
            } else if (code) response = '```typescript\nconst greeting = "Hello"\n```'
            enqueueText(controller, response)
          }
        })
      },
      async reconnectToStream() {
        return null
      }
    }))

    function enqueueCodexTools(controller: ReadableStreamDefaultController): void {
      for (const [name, result] of [
        ['get_selection', { content: [{ type: 'text', text: '{"selection": []}' }] }],
        ['get_node', { content: [{ type: 'text', text: 'Node not found' }], isError: true }]
      ] as const) {
        controller.enqueue({
          type: 'tool-input-available',
          toolCallId: name,
          toolName: `mcp.open-pencil.${name}`,
          input: {},
          providerExecuted: true
        })
        controller.enqueue({
          type: 'tool-output-available',
          toolCallId: name,
          output: { result, error: null },
          providerExecuted: true
        })
      }
    }

    function enqueueImageTool(controller: ReadableStreamDefaultController): void {
      const image =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEAQH/69cbGAAAAABJRU5ErkJggg=='
      controller.enqueue({
        type: 'tool-input-available',
        toolCallId: 'image-tool',
        toolName: 'set_image_fill',
        input: { id: '1:2', image_data: image },
        providerExecuted: true
      })
      controller.enqueue({
        type: 'tool-output-available',
        toolCallId: 'image-tool',
        output: {
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  image_data: image,
                  width: 1,
                  height: 1
                })
              }
            ]
          },
          error: null
        },
        providerExecuted: true
      })
    }

    function enqueueText(controller: ReadableStreamDefaultController, text: string): void {
      controller.enqueue({ type: 'text-start', id: 'text-1' })
      controller.enqueue({ type: 'text-delta', id: 'text-1', delta: text })
      controller.enqueue({ type: 'text-end', id: 'text-1' })
      controller.enqueue({ type: 'finish', finishReason: 'stop' })
      controller.close()
    }

    function enqueueReasoning(controller: ReadableStreamDefaultController): void {
      controller.enqueue({ type: 'reasoning-start', id: 'reasoning-1' })
      controller.enqueue({
        type: 'reasoning-delta',
        id: 'reasoning-1',
        delta: 'Inspecting the referenced layout.'
      })
      controller.enqueue({ type: 'reasoning-end', id: 'reasoning-1' })
    }

    function enqueueMultipleTextParts(controller: ReadableStreamDefaultController): void {
      for (const [id, delta] of [
        ['text-a', 'First'],
        ['text-b', 'Second']
      ]) {
        controller.enqueue({ type: 'text-start', id })
        controller.enqueue({ type: 'text-delta', id, delta })
        controller.enqueue({ type: 'text-end', id })
      }
      controller.enqueue({ type: 'finish', finishReason: 'stop' })
      controller.close()
    }

    function enqueueToolCall(controller: ReadableStreamDefaultController, messageId: string): void {
      const toolCallId = `call-${messageId}`
      controller.enqueue({ type: 'tool-input-start', toolCallId, toolName: 'create_shape' })
      controller.enqueue({
        type: 'tool-input-delta',
        toolCallId,
        inputTextDelta: '{"type":"FRAME","x":100,"y":100,"width":200,"height":150,"name":"Card"}'
      })
      controller.enqueue({
        type: 'tool-input-available',
        toolCallId,
        toolName: 'create_shape',
        input: { type: 'FRAME', x: 100, y: 100, width: 200, height: 150, name: 'Card' }
      })
      controller.enqueue({
        type: 'tool-output-available',
        toolCallId,
        toolName: 'create_shape',
        output: { id: '0:99', type: 'FRAME', name: 'Card' }
      })
    }
  })
}
