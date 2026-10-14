import type { ACPChatTransport } from './transport'

/** Collect a bounded review or inspection reply; the caller owns the session and cancellation. */
export async function requestAgentText(
  transport: Pick<ACPChatTransport, 'sendMessages'>,
  prompt: string,
  signal: AbortSignal,
  failure: (message: string) => Error = (message) => new Error(message)
): Promise<string> {
  signal.throwIfAborted()
  const stream = await transport.sendMessages({
    chatId: crypto.randomUUID(),
    trigger: 'submit-message',
    messageId: undefined,
    messages: [{ id: crypto.randomUUID(), role: 'user', parts: [{ type: 'text', text: prompt }] }],
    abortSignal: signal
  })
  const reader = stream.getReader()
  let text = ''
  try {
    for (;;) {
      const next = await reader.read()
      if (next.done) break
      if (next.value.type === 'error') throw failure(next.value.errorText)
      if (next.value.type === 'text-delta') text += next.value.delta
    }
  } finally {
    reader.releaseLock()
  }
  signal.throwIfAborted()
  return text
}
