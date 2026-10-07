import { useLocalStorage } from '@vueuse/core'

import { IS_TAURI } from '@open-pencil/core/constants'

export const LAYA_EXPERIMENT = import.meta.env.VITE_EXPERIMENTAL_LAYA === 'true'
export const LAYA_SUPPORTED = LAYA_EXPERIMENT && IS_TAURI
export const automaticRouting = useLocalStorage('open-pencil:experimental-laya-routing', false)
