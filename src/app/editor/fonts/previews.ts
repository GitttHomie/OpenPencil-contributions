import { limitAsync } from 'es-toolkit'

import { WEB_FONT_PROVIDER_IDS } from '@open-pencil/core/text'
import type { FontFamilySource } from '@open-pencil/core/text'

const MAX_PREVIEW_LOADS = 4

export type FontPreviewRequest = (family: string, source: FontFamilySource) => () => void

/** Share visible-row requests and skip queued previews after their rows leave the viewport. */
export function createFontPreviewQueue(
  load: (family: string) => Promise<ArrayBuffer | null>
): FontPreviewRequest {
  const loaded = new Set<string>()
  const pending = new Map<string, Set<symbol>>()
  const run = limitAsync(async (family: string, consumers: Set<symbol>) => {
    if (consumers.size === 0) return
    if (await load(family)) loaded.add(family)
  }, MAX_PREVIEW_LOADS)

  return (family, source) => {
    if (!WEB_FONT_PROVIDER_IDS.some((provider) => provider === source) || loaded.has(family))
      return () => undefined
    const consumer = Symbol(family)
    let consumers = pending.get(family)
    if (!consumers) {
      consumers = new Set([consumer])
      pending.set(family, consumers)
      // A preview failure leaves normal font selection and a later preview retry available.
      void run(family, consumers)
        .catch(() => undefined)
        .finally(() => pending.delete(family))
    } else {
      consumers.add(consumer)
    }
    const requestConsumers = consumers
    return () => requestConsumers.delete(consumer)
  }
}
