import { ACP_AGENTS } from '@open-pencil/core/constants'

import { lookupAgents } from '@/app/ai/agents/native'
import { resolvePlatformCommand } from '@/app/tauri/command'

import type { TauriChild } from './process'

type ProcessStartOptions = {
  command: string
  args: string[]
  env?: Record<string, string>
  stdout: (data: Uint8Array | number[]) => void
  stderr: (data: Uint8Array | number[] | string) => void
  close: () => void
}

type AgentEvent = { event: 'stdout' | 'stderr'; data: number[] } | { event: 'close' }

/** Fixed invocations use shell scopes; configured invocations are validated by native code. */
export async function startAgentProcess(options: ProcessStartOptions): Promise<TauriChild> {
  const agent = ACP_AGENTS.find((candidate) => candidate.command === options.command)
  if (!agent) throw new Error('Unknown ACP executable.')
  const configured =
    Object.keys(options.env ?? {}).length > 0 ||
    options.args.length !== agent.args.length ||
    options.args.some((arg, index) => arg !== agent.args[index])
  if (configured) {
    const { Channel, invoke } = await import('@tauri-apps/api/core')
    const events = new Channel<AgentEvent>((event) => {
      if (event.event === 'close') options.close()
      else options[event.event](event.data)
    })
    const pid = await invoke<number>('agent_process_spawn', {
      command: options.command,
      args: options.args,
      env: options.env ?? {},
      events
    })
    return {
      write: (data) => invoke('agent_process_write', { pid, data }),
      kill: () => invoke('agent_process_kill', { pid })
    }
  }
  const { Command } = await import('@tauri-apps/plugin-shell')
  const lookup = await lookupAgents()
  const resolved = resolvePlatformCommand(options.command, options.args)
  const command = Command.create(resolved.command, resolved.args, {
    encoding: 'raw',
    env: { PATH: lookup.searchPath }
  })
  command.stdout.on('data', options.stdout)
  command.stderr.on('data', options.stderr)
  command.on('close', options.close)
  return command.spawn()
}
