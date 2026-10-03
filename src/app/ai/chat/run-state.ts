import type { FinishReason } from 'ai'
import { shallowRef } from 'vue'

export type ChatRunPhase = 'working' | 'finished' | 'stopped' | 'failed' | 'interrupted' | 'limited'
export interface ChatRunState {
  phase: ChatRunPhase
  startedAt: number
  endedAt?: number
}

export function createChatRunState() {
  const state = shallowRef<ChatRunState | null>(null)
  function start() {
    state.value = { phase: 'working', startedAt: Date.now() }
  }
  function end(phase: ChatRunPhase) {
    if (state.value?.phase !== 'working') return
    state.value = { ...state.value, phase, endedAt: Date.now() }
  }
  function finish(event: {
    finishReason?: FinishReason
    isAbort: boolean
    isDisconnect: boolean
    isError: boolean
  }) {
    if (event.isAbort) end('stopped')
    else if (event.isError || event.finishReason === 'error') end('failed')
    else if (event.isDisconnect) end('interrupted')
    else if (event.finishReason === 'length' || event.finishReason === 'tool-calls') end('limited')
    else end(event.finishReason === 'stop' ? 'finished' : 'interrupted')
  }
  return { state, start, finish, fail: () => end('failed') }
}
