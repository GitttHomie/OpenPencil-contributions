import type { ChatTransport, UIMessage } from 'ai'

type Role = 'design' | 'fast'
type Options = {
  enabled: () => boolean
  fastAvailable: () => boolean
  decide: (text: string) => Promise<Role>
  create: (role: Role) => Promise<ChatTransport<UIMessage>>
  selected: (role: Role) => void
  allows?: (message: UIMessage) => boolean
}

async function chooseRole(messages: UIMessage[], options: Options): Promise<Role> {
  const message = messages.at(-1)
  if (messages.length !== 1 || message?.role !== 'user') return 'design'
  if (!message.parts.every((part) => part.type === 'text')) return 'design'
  const text = message.parts.map((part) => part.text).join('\n')
  if (text.length === 0 || text.length > 1500 || !options.enabled() || !options.fastAvailable())
    return 'design'
  if (options.allows && !options.allows(message)) return 'design'
  return options.decide(text).catch(() => 'design' as const)
}

/** Route once per conversation; never switch a live external agent's context. */
export function createRoutingTransport(options: Options): ChatTransport<UIMessage> {
  let transport: ChatTransport<UIMessage> | undefined
  return {
    async sendMessages(request) {
      if (!transport) {
        let role = await chooseRole(request.messages, options)
        if (request.abortSignal?.aborted) throw new DOMException('Aborted', 'AbortError')
        if (!options.enabled() || !options.fastAvailable()) role = 'design'
        try {
          transport = await options.create(role)
        } catch (error) {
          if (role === 'design') throw error
          if (request.abortSignal?.aborted) throw new DOMException('Aborted', 'AbortError')
          role = 'design'
          transport = await options.create(role)
        }
        if (request.abortSignal?.aborted) throw new DOMException('Aborted', 'AbortError')
        options.selected(role)
      }
      return transport.sendMessages(request)
    },
    reconnectToStream: (request) => transport?.reconnectToStream(request) ?? Promise.resolve(null)
  }
}
