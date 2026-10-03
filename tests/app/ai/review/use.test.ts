import 'fake-indexeddb/auto'
import { expect, test } from 'bun:test'

import { effectScope, nextTick } from 'vue'

import { ACPModelSelectionError } from '@/app/ai/acp/models'
import type { ReviewResult } from '@/app/ai/review/run'
import { useDesignReview } from '@/app/ai/review/use'
import { createEditorStore } from '@/app/editor/session/create'
import { createDeferred } from '@/app/runtime/deferred'

test('a rejected CLI model selection gives actionable Review feedback', async () => {
  const store = createEditorStore()
  const scope = effectScope()
  const review = scope.run(() =>
    useDesignReview(
      () => store,
      async () => {
        throw new ACPModelSelectionError('Selected model is unavailable')
      }
    )
  )
  if (!review) throw new Error('Missing review workflow')
  try {
    await review.run()
    expect(review.error.value).toBe('model-unavailable')
    expect(review.result.value).toBeNull()
    expect(review.busy.value).toBe(false)
  } finally {
    scope.stop()
    store.dispose()
  }
})

test('closing a review cancels it and discards a late result', async () => {
  const store = createEditorStore()
  const scope = effectScope()
  const pending = createDeferred<ReviewResult>()
  let signal: AbortSignal | undefined
  const review = scope.run(() =>
    useDesignReview(
      () => store,
      async (_, request) => {
        signal = request.signal
        return pending.promise
      }
    )
  )
  if (!review) throw new Error('Missing review workflow')
  try {
    review.open.value = true
    await nextTick()
    const running = review.run()
    expect(review.busy.value).toBe(true)
    review.open.value = false
    await nextTick()
    expect(signal?.aborted).toBe(true)
    pending.resolve({ text: 'Stale', imageIncluded: false, nodeIds: [], profileName: 'Old model' })
    await running
    expect(review.result.value).toBeNull()
    expect(review.busy.value).toBe(false)
  } finally {
    scope.stop()
    store.dispose()
  }
})
