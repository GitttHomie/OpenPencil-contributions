import { useIntervalFn, useLocalStorage } from '@vueuse/core'
import type { UIMessageChunk } from 'ai'
import { ref, watch } from 'vue'

import { diagnosticsEnvironment } from '@/app/diagnostics/environment'
import { IS_TAURI } from '@/constants'

import { createSessionCapture } from './capture'
import { createSessionLogStore } from './store'
import type { SessionLog } from './types'

const FLUSH_INTERVAL_MS = 2000
export const sessionLoggingEnabled = useLocalStorage('open-pencil:ai-session-logging', true)
export const sessionLoggingFailed = ref(false)
const store = createSessionLogStore()
const active = new Map<string, ReturnType<typeof startCapture>>()
const writtenAssets = new Set<string>()
let writes = Promise.resolve()
let generation = 0
const pending = new Map<string, { log: SessionLog; epoch: number }>()
let draining = false

function persist(log: SessionLog, epoch: number) {
  if (epoch !== generation) return
  pending.set(log.id, { log: structuredClone(log), epoch })
  if (draining) return
  draining = true
  writes = writes
    .then(async () => {
      for (const [id, entry] of pending) {
        pending.delete(id)
        if (entry.epoch !== generation) continue
        try {
          const expired = await store.write(entry.log)
          if (IS_TAURI) {
            const files = await import('./files')
            await files.writeSessionLogFiles(entry.log, writtenAssets)
            await files.removeSessionLogFiles(expired)
            for (const key of writtenAssets) {
              if (expired.some((expiredId) => key.startsWith(`${expiredId}/`)))
                writtenAssets.delete(key)
            }
          }
        } catch {
          sessionLoggingFailed.value = true
        }
      }
      return undefined
    })
    .finally(() => {
      draining = false
    })
}

function startCapture(sessionId: string, runId: string) {
  const epoch = generation
  let dirty = false
  let finished = false
  const capture = createSessionCapture(sessionId, runId, () => {
    dirty = true
  })
  const timer = useIntervalFn(() => {
    safely(() => {
      capture.checkpoint()
      if (!dirty) return
      dirty = false
      persist(capture.log, epoch)
    })
  }, FLUSH_INTERVAL_MS)
  // Recording must never fail the request, swallow a tool result, or reject a permission.
  function safely(action: () => void) {
    if (finished) return
    try {
      action()
    } catch {
      sessionLoggingFailed.value = true
      finished = true
      timer.pause()
      active.delete(runId)
    }
  }
  return {
    checkpoint() {
      safely(() => {
        capture.checkpoint()
        persist(capture.log, epoch)
      })
    },
    observe(chunk: UIMessageChunk) {
      safely(() => capture.observe(chunk))
    },
    record(type: string, data: unknown) {
      safely(() => capture.record(type, data))
    },
    finish(status: SessionLog['status'], details?: unknown) {
      if (finished) return
      safely(() => {
        capture.finish(status, details)
        persist(capture.log, epoch)
      })
      finished = true
      timer.pause()
      active.delete(runId)
    }
  }
}

/** No provider credentials, endpoints or CLI environment are copied into run metadata. */
export function startSessionLog(sessionId: string, runId: string, request: unknown) {
  if (!sessionLoggingEnabled.value || typeof indexedDB === 'undefined') return null
  const capture = startCapture(sessionId, runId)
  active.set(runId, capture)
  capture.record('run.start', { environment: diagnosticsEnvironment(), request })
  return capture
}

export function recordSessionEvent(runId: string | undefined, type: string, data: unknown) {
  if (runId) active.get(runId)?.record(type, data)
}

watch(sessionLoggingEnabled, (enabled) => {
  if (!enabled) {
    for (const capture of active.values()) capture.finish('stopped', { reason: 'Logging disabled' })
  }
})

export const sessionLogs = {
  async list() {
    for (const capture of active.values()) capture.checkpoint()
    await writes
    return store.list()
  },
  async clear() {
    generation++
    pending.clear()
    for (const capture of active.values()) capture.finish('stopped', { reason: 'Logs cleared' })
    await writes
    const logs = await store.list()
    if (IS_TAURI) await (await import('./files')).removeSessionLogFiles(logs.map((log) => log.id))
    await store.clear()
    writtenAssets.clear()
    sessionLoggingFailed.value = false
  }
}
