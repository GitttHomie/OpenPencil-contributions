import { invoke } from '@tauri-apps/api/core'
import { platform } from '@tauri-apps/plugin-os'
import { useEyeDropper } from '@vueuse/core'
import * as v from 'valibot'
import { computed, onDeactivated, onScopeDispose, ref } from 'vue'

import { IS_TAURI } from '@open-pencil/core/constants'
import type { Color } from '@open-pencil/scene-graph'
import { parseColor } from '@open-pencil/scene-graph/color'

import { getActiveEditorStoreOrNull } from '@/app/editor/active-store'

const channel = v.pipe(v.number(), v.minValue(0), v.maxValue(1))
const sampledColor = v.nullable(v.tuple([channel, channel, channel]))

/** A user-triggered screen sample; cancellation and stale picker results never edit a color. */
export function useScreenColorSampler(onPick: (color: Color) => void) {
  const browser = useEyeDropper()
  const native = IS_TAURI && platform() === 'macos'
  const supported = computed(() => native || browser.isSupported.value)
  const active = ref(false)
  const error = ref(false)
  let request: AbortController | undefined

  function cancel() {
    request?.abort()
    request = undefined
    active.value = false
  }
  onScopeDispose(cancel)
  onDeactivated(cancel)

  async function sample(alpha: number, signal: AbortSignal): Promise<Color | undefined> {
    if (native) {
      const result = v.safeParse(sampledColor, await invoke<unknown>('pick_screen_color'))
      if (!result.success) throw new Error('Invalid sampled color')
      if (!result.output) return undefined
      const [r, g, b] = result.output
      return { r, g, b, a: alpha }
    }
    const result = await browser.open({ signal })
    if (result) return { ...parseColor(result.sRGBHex), a: alpha }
    return undefined
  }

  async function pick(alpha: number) {
    if (!supported.value || active.value) return
    const controller = new AbortController()
    request = controller
    active.value = true
    error.value = false
    const editor = getActiveEditorStoreOrNull()
    const stopSelection = editor?.onEditorEvent('selection:changed', cancel)
    const stopPage = editor?.onEditorEvent('page:changed', cancel)
    const stopGraph = editor?.onEditorEvent('graph:replaced', cancel)
    try {
      const color = await sample(alpha, controller.signal)
      if (color && request === controller && !controller.signal.aborted) onPick(color)
    } catch (cause) {
      if (
        !controller.signal.aborted &&
        !(cause instanceof DOMException && cause.name === 'AbortError')
      )
        error.value = true
    } finally {
      stopSelection?.()
      stopPage?.()
      stopGraph?.()
      if (request === controller) {
        request = undefined
        active.value = false
      }
    }
  }
  return { supported, active, error, pick }
}
