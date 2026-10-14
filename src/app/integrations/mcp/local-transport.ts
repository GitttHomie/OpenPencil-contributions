import {
  deserializeMessage,
  serializeMessage,
  type JSONRPCMessage,
  type Transport
} from '@modelcontextprotocol/client'
import { Channel, invoke } from '@tauri-apps/api/core'

type ProcessEvent = { event: 'stdout' | 'stderr'; data: number[] } | { event: 'close' }
const MAX_MESSAGE_LENGTH = 32 * 1024 * 1024

export class LocalMCPTransport implements Transport {
  onmessage?: Transport['onmessage']
  onerror?: Transport['onerror']
  onclose?: Transport['onclose']
  private pid?: number
  private closed = false
  private started = false
  private notified = false
  private buffer = ''
  private decoder = new TextDecoder()

  constructor(private options: { command: string; args: string[]; env: Record<string, string> }) {}

  async start() {
    if (this.started || this.closed)
      throw new Error('The MCP connection has already started or closed.')
    this.started = true
    const events = new Channel<ProcessEvent>((event) => {
      if (event.event === 'close') {
        this.pid = undefined
        this.closed = true
        this.notifyClose()
      } else if (event.event === 'stdout') {
        try {
          this.buffer += this.decoder.decode(new Uint8Array(event.data), { stream: true })
          if (this.buffer.length > MAX_MESSAGE_LENGTH) throw new Error('MCP message too large.')
          let end = this.buffer.indexOf('\n')
          while (end !== -1) {
            const line = this.buffer.slice(0, end)
            this.buffer = this.buffer.slice(end + 1)
            if (line.trim()) this.onmessage?.(deserializeMessage(line))
            end = this.buffer.indexOf('\n')
          }
        } catch {
          this.onerror?.(new Error('The MCP server returned invalid protocol data.'))
          void this.close().catch(() => undefined)
        }
      }
      // Server stderr can contain credentials; it is not copied into app logs.
    })
    this.pid = await invoke<number>('mcp_process_spawn', { ...this.options, events })
    await this.closeIfCancelled()
  }

  private async closeIfCancelled() {
    if (this.closed) await this.close()
  }

  async send(message: JSONRPCMessage) {
    if (!this.pid || this.closed) throw new Error('The MCP connection is closed.')
    await invoke('agent_process_write', {
      pid: this.pid,
      data: Array.from(new TextEncoder().encode(serializeMessage(message)))
    })
  }

  async close() {
    this.closed = true
    const pid = this.pid
    this.pid = undefined
    try {
      if (pid) await invoke('agent_process_kill', { pid })
    } finally {
      this.notifyClose()
    }
  }

  private notifyClose() {
    if (this.notified) return
    this.notified = true
    this.onclose?.()
  }
}
