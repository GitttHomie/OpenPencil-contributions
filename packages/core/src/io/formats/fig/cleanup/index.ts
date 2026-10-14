import {
  prepareFigComponentCleanup,
  type FigCleanupOptions,
  type FigCleanupChoice
} from '@open-pencil/fig'

import type { CleanupRequest, CleanupResponse } from './protocol'

export interface FigCleanupResult {
  bytes: ArrayBuffer
  cleaned: boolean
}

/** Keeps archive decoding and rewriting off the UI thread; declining returns the original. */
export async function cleanFigFileOnOpen(
  bytes: ArrayBuffer,
  confirm: (summary: FigCleanupOptions) => Promise<FigCleanupChoice>,
  signal?: AbortSignal
): Promise<FigCleanupResult> {
  signal?.throwIfAborted()
  if (typeof Worker === 'undefined') {
    const cleanup = prepareFigComponentCleanup(bytes)
    const choice =
      cleanup.options.unused.componentCount > 0 || cleanup.options.internal.nodeCount > 0
        ? await confirm(cleanup.options)
        : 'keep'
    signal?.throwIfAborted()
    return choice !== 'keep'
      ? { bytes: new Uint8Array(cleanup.apply(choice)).buffer, cleaned: true }
      : { bytes, cleaned: false }
  }
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
  return new Promise((resolve, reject) => {
    const dispose = () => {
      signal?.removeEventListener('abort', abort)
      worker.terminate()
    }
    const fail = (error: unknown) => {
      dispose()
      reject(error instanceof Error ? error : new Error(String(error)))
    }
    const abort = () => fail(new DOMException('Aborted', 'AbortError'))
    signal?.addEventListener('abort', abort, { once: true })
    const send = (request: CleanupRequest, transfer: Transferable[] = []) =>
      worker.postMessage(request, transfer)
    worker.onerror = (event) => fail(new Error(event.message || 'Cleanup worker failed'))
    worker.onmessage = (event: MessageEvent<CleanupResponse>) => {
      const response = event.data
      if (response.type === 'error') {
        fail(new Error(response.message))
      } else if (response.type === 'cleaned') {
        dispose()
        resolve({ bytes: response.bytes.buffer, cleaned: true })
      } else {
        void (async () => {
          const choice =
            response.summary.unused.componentCount > 0 || response.summary.internal.nodeCount > 0
              ? await confirm(response.summary)
              : 'keep'
          signal?.throwIfAborted()
          if (choice !== 'keep') send({ type: 'apply', choice })
          else {
            dispose()
            resolve({ bytes, cleaned: false })
          }
        })().catch(fail)
      }
    }
    const copy = bytes.slice(0)
    send({ type: 'analyze', bytes: copy }, [copy])
  })
}
