import { tryOnScopeDispose } from '@vueuse/core'
import { computed, ref, shallowRef, watch } from 'vue'

import { ACPModelSelectionError } from '@/app/ai/acp/models'
import { resolveAIModelRole } from '@/app/ai/models'
import type { EditorStore } from '@/app/editor/active-store'

import { DesignReviewError, reviewDesign, type ReviewResult } from './run'

export function useDesignReview(getEditor: () => EditorStore, runReview = reviewDesign) {
  const open = ref(false)
  const focus = ref('')
  const busy = ref(false)
  const result = shallowRef<ReviewResult | null>(null)
  const error = ref<DesignReviewError['reason'] | 'model-unavailable' | null>(null)
  const model = computed(() => resolveAIModelRole('review')?.profile ?? null)
  let operation: AbortController | null = null

  function cancel() {
    operation?.abort()
    operation = null
    busy.value = false
  }

  async function run() {
    if (busy.value) return
    const controller = new AbortController()
    operation = controller
    busy.value = true
    error.value = null
    result.value = null
    try {
      const next = await runReview(getEditor(), { focus: focus.value, signal: controller.signal })
      if (operation === controller) result.value = next
    } catch (reason) {
      if (operation === controller && !controller.signal.aborted) {
        if (reason instanceof ACPModelSelectionError) error.value = 'model-unavailable'
        else error.value = reason instanceof DesignReviewError ? reason.reason : 'failed'
      }
    } finally {
      if (operation === controller) {
        busy.value = false
        operation = null
      }
    }
  }

  watch(open, (value) => {
    if (!value) cancel()
  })
  watch(
    () => [getEditor(), getEditor().state.currentPageId, model.value?.id],
    () => {
      cancel()
      result.value = null
      error.value = null
    }
  )
  tryOnScopeDispose(cancel)

  return { open, focus, busy, result, error, model, run, cancel }
}
