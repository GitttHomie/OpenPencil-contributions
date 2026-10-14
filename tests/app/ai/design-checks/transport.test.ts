import { expect, test } from 'bun:test'

import { readUIMessageStream, type ChatTransport, type UIMessage, type UIMessageChunk } from 'ai'

import { withDesignChecks, type DesignCheckCycle } from '@/app/ai/design-checks/transport'

function response(text: string, error = false, interrupted = false) {
  return new ReadableStream<UIMessageChunk>({
    start(controller) {
      controller.enqueue({ type: 'start', messageId: 'reply' })
      controller.enqueue({ type: 'text-start', id: '0' })
      controller.enqueue({ type: 'text-delta', id: '0', delta: text })
      controller.enqueue({ type: 'text-end', id: '0' })
      if (error) controller.enqueue({ type: 'error', errorText: 'Provider failed' })
      if (!interrupted)
        controller.enqueue({ type: 'finish', finishReason: error ? 'error' : 'stop' })
      controller.close()
    }
  })
}

const request = {
  chatId: 'chat',
  trigger: 'submit-message' as const,
  messageId: undefined,
  abortSignal: undefined,
  messages: [
    {
      id: 'user',
      role: 'user' as const,
      parts: [{ type: 'text' as const, text: 'Design a card.' }]
    }
  ]
}

test('automatic checks keep one reply and bound corrections before a read-only final pass', async () => {
  let revision = 0
  let checkpoint = -1
  let readOnly = false
  let finished = false
  const allowed: boolean[] = []
  const requests: UIMessage[][] = []
  const cycle: DesignCheckCycle = {
    changed: () => revision > 0,
    async prepare(corrections) {
      allowed.push(corrections)
      checkpoint = revision
      return {
        id: `check-${allowed.length}`,
        role: 'user',
        parts: [{ type: 'text', text: 'Check it.' }]
      }
    },
    reviewed: () => checkpoint === revision,
    readOnly: (value) => {
      readOnly = value
    },
    finish: () => {
      finished = true
    }
  }
  const base: ChatTransport<UIMessage> = {
    reconnectToStream: async () => null,
    async sendMessages(options) {
      requests.push([...options.messages])
      if (!readOnly) revision++
      return response(`Pass ${requests.length}.`)
    }
  }
  const transport = withDesignChecks(base, {
    settings: () => ({ automatic: true, corrections: true, maxCorrectionPasses: 2 }),
    start: () => cycle
  })
  const [display, history] = (await transport.sendMessages(request)).tee()
  const rendered = (async () => {
    let last: UIMessage | undefined
    for await (const message of readUIMessageStream({ stream: history })) last = message
    return last
  })()
  const chunks: UIMessageChunk[] = []
  for await (const chunk of display) chunks.push(chunk)
  const message = await rendered
  expect(allowed).toEqual([true, true, false])
  expect(requests).toHaveLength(4)
  expect(requests.at(-1)?.filter((item) => item.role === 'assistant')).toHaveLength(3)
  expect(chunks.filter((chunk) => chunk.type === 'start')).toHaveLength(1)
  expect(chunks.filter((chunk) => chunk.type === 'finish')).toHaveLength(1)
  expect(message?.parts.filter((part) => part.type === 'text').map((part) => part.text)).toEqual([
    'Pass 1.',
    'Pass 2.',
    'Pass 3.',
    'Pass 4.'
  ])
  expect(readOnly).toBe(false)
  expect(finished).toBe(true)
})

for (const kind of [
  'disabled',
  'unchanged',
  'failed',
  'stopped',
  'interrupted',
  'broken-stream'
] as const) {
  test(`does not launch review for a ${kind} run`, async () => {
    const controller = new AbortController()
    let calls = 0
    let finished = false
    const transport = withDesignChecks(
      {
        reconnectToStream: async () => null,
        async sendMessages() {
          calls++
          if (kind === 'stopped') controller.abort()
          if (kind === 'broken-stream')
            return new ReadableStream<UIMessageChunk>({
              start(controller) {
                controller.error(new Error('Disconnected'))
              }
            })
          return response('Result', kind === 'failed', kind === 'interrupted')
        }
      },
      {
        settings: () => ({
          automatic: kind !== 'disabled',
          corrections: true,
          maxCorrectionPasses: 2
        }),
        start: () => ({
          changed: () => kind !== 'unchanged',
          reviewed: () => true,
          prepare: async () => {
            throw new Error('Unexpected review')
          },
          readOnly: () => undefined,
          finish: () => {
            finished = true
          }
        })
      }
    )
    const stream = await transport.sendMessages({ ...request, abortSignal: controller.signal })
    const chunks: UIMessageChunk[] = []
    for await (const chunk of stream) chunks.push(chunk)
    if (kind === 'interrupted') {
      expect(chunks.some((chunk) => chunk.type === 'finish')).toBe(false)
      expect(chunks.at(-1)?.type).toBe('abort')
    }
    if (kind === 'broken-stream') {
      expect(chunks).toEqual([{ type: 'error', errorText: 'Disconnected' }])
    }
    expect(calls).toBe(1)
    expect(finished).toBe(kind !== 'disabled')
  })
}

test('report-only checks cannot request a correction pass', async () => {
  const allowed: boolean[] = []
  const transport = withDesignChecks(
    {
      reconnectToStream: async () => null,
      sendMessages: async () => response('Findings')
    },
    {
      settings: () => ({ automatic: true, corrections: false, maxCorrectionPasses: 2 }),
      start: () => ({
        changed: () => true,
        reviewed: () => true,
        readOnly: () => undefined,
        finish: () => undefined,
        async prepare(corrections) {
          allowed.push(corrections)
          return { id: 'check', role: 'user', parts: [{ type: 'text', text: 'Inspect only.' }] }
        }
      })
    }
  )
  for await (const _chunk of await transport.sendMessages(request)) {
    /* consume */
  }
  expect(allowed).toEqual([false])
})
