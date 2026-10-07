import * as v from 'valibot'
import { shallowRef } from 'vue'

import { LAYA_SUPPORTED } from './preferences'

const statusSchema = v.object({
  installed: v.boolean(),
  loaded: v.boolean(),
  busy: v.boolean()
})
const progressSchema = v.object({
  stage: v.picklist(['runtime', 'download', 'loading']),
  completed: v.optional(v.number()),
  total: v.optional(v.number())
})
export const layaStatus = shallowRef<v.InferOutput<typeof statusSchema>>({
  installed: false,
  loaded: false,
  busy: false
})
export const layaProgress = shallowRef<v.InferOutput<typeof progressSchema> | null>(null)
export const layaFailure = shallowRef<string | null>(null)

export async function refreshLaya(): Promise<void> {
  if (!LAYA_SUPPORTED) return
  const { invoke } = await import('@tauri-apps/api/core')
  layaStatus.value = v.parse(statusSchema, await invoke<unknown>('laya_status'))
}

export async function prepareLaya(): Promise<void> {
  if (!LAYA_SUPPORTED || layaStatus.value.busy) return
  layaFailure.value = null
  layaStatus.value = { ...layaStatus.value, busy: true }
  try {
    const { Channel, invoke } = await import('@tauri-apps/api/core')
    const progress = new Channel<unknown>()
    progress.onmessage = (value) => {
      const result = v.safeParse(progressSchema, value)
      if (result.success) layaProgress.value = result.output
    }
    await invoke('laya_prepare', { progress })
  } catch (error) {
    if (error !== 'cancelled')
      layaFailure.value = error === 'python-required' ? 'python-required' : 'setup-failed'
  } finally {
    layaProgress.value = null
    layaStatus.value = { ...layaStatus.value, busy: false }
    await refreshLaya().catch(() => undefined)
  }
}

export async function unloadLaya(): Promise<void> {
  if (!LAYA_SUPPORTED) return
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('laya_unload')
  layaStatus.value = { ...layaStatus.value, loaded: false }
}

export async function predictLaya(request: unknown): Promise<unknown> {
  if (!LAYA_SUPPORTED || !layaStatus.value.loaded) throw new Error('Laya is not loaded')
  const { invoke } = await import('@tauri-apps/api/core')
  try {
    return await invoke<unknown>('laya_predict', { request })
  } catch (error) {
    layaStatus.value = { ...layaStatus.value, loaded: false }
    throw error
  }
}
