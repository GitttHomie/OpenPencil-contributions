import { shallowRef } from 'vue'

import type { FigCleanupOptions, FigCleanupChoice } from '@open-pencil/fig'

export const cleanupPrompt = shallowRef<(FigCleanupOptions & { fileName: string }) | null>(null)
let answer: ((accepted: FigCleanupChoice) => void) | undefined
let pending = Promise.resolve()

export function answerCleanupPrompt(accepted: FigCleanupChoice): void {
  answer?.(accepted)
}

/** File opens can overlap; each prompt belongs to its own cancellable import. */
export function requestFigCleanup(
  fileName: string,
  summary: FigCleanupOptions,
  signal?: AbortSignal
): Promise<FigCleanupChoice> {
  const result = pending.then(() => {
    signal?.throwIfAborted()
    return new Promise<FigCleanupChoice>((resolve) => {
      const finish = (accepted: FigCleanupChoice) => {
        signal?.removeEventListener('abort', abort)
        cleanupPrompt.value = null
        answer = undefined
        resolve(accepted)
      }
      const abort = () => finish('keep')
      answer = finish
      signal?.addEventListener('abort', abort, { once: true })
      cleanupPrompt.value = { ...summary, fileName }
    })
  })
  pending = result.then(
    () => undefined,
    () => undefined
  )
  return result
}
