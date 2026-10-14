import { prepareFigComponentCleanup } from '@open-pencil/fig'

import type { CleanupRequest, CleanupResponse } from './protocol'

let cleanup: ReturnType<typeof prepareFigComponentCleanup> | undefined
function respond(response: CleanupResponse, transfer: Transferable[] = []): void {
  self.postMessage(response, { transfer })
}

self.onmessage = (event: MessageEvent<CleanupRequest>) => {
  try {
    if (event.data.type === 'analyze') {
      cleanup = prepareFigComponentCleanup(event.data.bytes)
      respond({ type: 'summary', summary: cleanup.options })
    } else {
      if (!cleanup) throw new Error('No cleanup has been analyzed')
      const bytes = new Uint8Array(cleanup.apply(event.data.choice))
      respond({ type: 'cleaned', bytes }, [bytes.buffer])
      cleanup = undefined
    }
  } catch (error) {
    respond({
      type: 'error',
      message: error instanceof Error ? error.message : String(error)
    })
  }
}
