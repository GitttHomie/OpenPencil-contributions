import { readUIMessageStream, type ChatTransport, type UIMessage, type UIMessageChunk } from 'ai'

export type DesignCheckCycle = {
  changed(): boolean
  prepare(allowCorrections: boolean, signal?: AbortSignal): Promise<UIMessage>
  reviewed(): boolean
  readOnly(value: boolean): void
  finish(): void
}

type Options = {
  settings(): { automatic: boolean; corrections: boolean; maxCorrectionPasses: number }
  start(): DesignCheckCycle
}

/** Continue inside the same visible reply; never restart a stopped or failed run. */
export function withDesignChecks(
  transport: ChatTransport<UIMessage>,
  options: Options
): ChatTransport<UIMessage> {
  return {
    reconnectToStream: (request) => transport.reconnectToStream(request),
    async sendMessages(request) {
      const settings = { ...options.settings() }
      if (!settings.automatic) return transport.sendMessages(request)
      const cycle = options.start()
      return new ReadableStream<UIMessageChunk>({
        async start(controller) {
          const messages = [...request.messages]
          let final: UIMessageChunk = { type: 'finish', finishReason: 'stop' }
          try {
            const limit = settings.corrections ? settings.maxCorrectionPasses : 0
            for (let pass = 0; pass <= limit + 1; pass++) {
              request.abortSignal?.throwIfAborted()
              if (pass > 0) {
                const allowCorrections = settings.corrections && pass <= limit
                cycle.readOnly(!allowCorrections)
                const review = await cycle.prepare(allowCorrections, request.abortSignal)
                request.abortSignal?.throwIfAborted()
                messages.push(review)
              }
              const next = { ...request, messages }
              if (pass > 0) {
                next.trigger = 'submit-message'
                next.messageId = undefined
              }
              const stream = await transport.sendMessages(next)
              const result = await forwardResponse(stream, controller, pass)
              final = result.final
              if (result.message) messages.push(result.message)
              if (result.failed || request.abortSignal?.aborted) break
              if (pass === 0 && !cycle.changed()) break
              if (pass > 0 && cycle.reviewed()) break
            }
            controller.enqueue(final)
            controller.close()
          } catch (error) {
            if (request.abortSignal?.aborted) controller.enqueue({ type: 'abort' })
            else
              controller.enqueue({
                type: 'error',
                errorText: error instanceof Error ? error.message : 'Design check failed.'
              })
            controller.close()
          } finally {
            cycle.readOnly(false)
            cycle.finish()
          }
        }
      })
    }
  }
}

async function forwardResponse(
  stream: ReadableStream<UIMessageChunk>,
  controller: ReadableStreamDefaultController<UIMessageChunk>,
  pass: number
) {
  const [display, history] = stream.tee()
  const completed = (async () => {
    let message: UIMessage | undefined
    for await (const next of readUIMessageStream({ stream: history })) message = next
    return message
  })()
  const [result, message] = await Promise.all([forwardChunks(display, controller, pass), completed])
  return { ...result, message }
}

async function forwardChunks(
  display: ReadableStream<UIMessageChunk>,
  controller: ReadableStreamDefaultController<UIMessageChunk>,
  pass: number
) {
  let failed = false
  let final: UIMessageChunk = { type: 'abort' }
  let finished = false
  const reader = display.getReader()
  try {
    for (;;) {
      const next = await reader.read()
      if (next.done) break
      const chunk = next.value
      if (chunk.type === 'error' || chunk.type === 'abort') failed = true
      if (chunk.type === 'finish') {
        finished = true
        final = chunk
        if (chunk.finishReason !== 'stop') failed = true
        continue
      }
      if (pass > 0 && chunk.type === 'start') continue
      controller.enqueue(
        'id' in chunk && typeof chunk.id === 'string'
          ? { ...chunk, id: `check-${pass}-${chunk.id}` }
          : chunk
      )
    }
  } finally {
    reader.releaseLock()
  }
  return { failed: failed || !finished, final }
}
