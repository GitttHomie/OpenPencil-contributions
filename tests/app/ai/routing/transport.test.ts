import { expect, test } from 'bun:test'

import type { ChatTransport, UIMessage } from 'ai'

import { createRoutingTransport } from '@/app/ai/routing/transport'

function request(
  messages: UIMessage[],
  signal?: AbortSignal
): Parameters<ChatTransport<UIMessage>['sendMessages']>[0] {
  return {
    chatId: 'test-chat',
    trigger: 'submit-message',
    messageId: undefined,
    messages,
    abortSignal: signal
  }
}
const first: UIMessage = {
  id: 'user',
  role: 'user',
  parts: [{ type: 'text', text: 'Rename this button' }]
}
const reply: UIMessage = {
  id: 'assistant',
  role: 'assistant',
  parts: [{ type: 'text', text: 'Done' }]
}

function harness(overrides: Partial<Parameters<typeof createRoutingTransport>[0]> = {}) {
  const calls: string[] = []
  const transport = createRoutingTransport({
    enabled: () => true,
    fastAvailable: () => true,
    decide: async () => {
      calls.push('decide')
      return 'fast'
    },
    create: async (role) => {
      calls.push(`create:${role}`)
      return {
        async sendMessages() {
          calls.push(`send:${role}`)
          return new ReadableStream({
            start(controller) {
              controller.close()
            }
          })
        },
        async reconnectToStream() {
          return null
        }
      }
    },
    selected: (role) => {
      calls.push(`selected:${role}`)
    },
    ...overrides
  })
  return { calls, transport }
}

test('chooses once and keeps the conversation on that transport', async () => {
  const { calls, transport } = harness()
  await transport.sendMessages(request([first]))
  await transport.sendMessages(request([first, reply, { ...first, id: 'followup' }]))
  expect(calls).toEqual(['decide', 'create:fast', 'selected:fast', 'send:fast', 'send:fast'])
})

for (const scenario of ['disabled', 'no-fast', 'restored', 'classifier-failed'] as const) {
  test(`${scenario} uses the Design model`, async () => {
    const { calls, transport } = harness({
      enabled: () => scenario !== 'disabled',
      fastAvailable: () => scenario !== 'no-fast',
      ...(scenario === 'classifier-failed'
        ? {
            decide: async () => {
              throw new Error('offline')
            }
          }
        : {})
    })
    await transport.sendMessages(request(scenario === 'restored' ? [first, reply, first] : [first]))
    expect(calls).toContain('create:design')
    expect(calls).not.toContain('create:fast')
  })
}

test('a stopped classification never starts an agent', async () => {
  const controller = new AbortController()
  const { calls, transport } = harness({
    decide: async () => {
      controller.abort()
      return 'fast'
    }
  })
  await expect(transport.sendMessages(request([first], controller.signal))).rejects.toThrow(
    'Aborted'
  )
  expect(calls).toEqual([])
})

test('image context and oversized requests bypass classification', async () => {
  const { calls, transport } = harness({ allows: () => false })
  await transport.sendMessages(request([first]))
  expect(calls).toEqual(['create:design', 'selected:design', 'send:design'])
  const long = harness()
  await long.transport.sendMessages(
    request([{ ...first, parts: [{ type: 'text', text: 'x'.repeat(1501) }] }])
  )
  expect(long.calls).not.toContain('decide')
})

test('failure to create the fast transport falls back before sending the request', async () => {
  const selected: string[] = []
  const { transport } = harness({
    create: async (role) => {
      if (role === 'fast') throw new Error('Missing credentials')
      return {
        async sendMessages() {
          return new ReadableStream({
            start(c) {
              c.close()
            }
          })
        },
        async reconnectToStream() {
          return null
        }
      }
    },
    selected: (role) => {
      selected.push(role)
    }
  })
  await transport.sendMessages(request([first]))
  expect(selected).toEqual(['design'])
})
