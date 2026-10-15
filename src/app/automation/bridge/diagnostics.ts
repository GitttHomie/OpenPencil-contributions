import { useIntervalFn } from '@vueuse/core'
import { watch } from 'vue'

import { canvasSessionLogger, recordCanvasRuntimeEvent } from '@/app/ai/acp/canvas/session'
import { sessionLoggingEnabled } from '@/app/ai/chat/logging/service'
import { recordDiagnostic } from '@/app/diagnostics/recorder'
import { isDiagnosticsEnabled } from '@/app/diagnostics/settings'
import type { DiagnosticAttributes } from '@/app/diagnostics/types'
import type { EditorStore } from '@/app/editor/active-store'

import { createRequestTrace } from './request-trace'
import { schedulingGap } from './scheduling-gap'

const SAMPLE_INTERVAL_MS = 1000
const STALL_THRESHOLD_MS = 500

export function createAutomationDiagnostics(
  getStore: () => EditorStore,
  configure: (enabled: boolean) => void
) {
  let disposed = false
  let documentSequence = 0
  const enabled = () => !disposed && (isDiagnosticsEnabled() || sessionLoggingEnabled.value)
  const context = () => ({
    documentSequence,
    pageId: getStore().state.currentPageId,
    nodes: getStore().graph.nodes.size,
    visibility: document.visibilityState,
    focused: document.hasFocus()
  })
  const trace = createRequestTrace({
    enabled,
    context,
    logger: canvasSessionLogger,
    write: ({ timestamp, attributes, failed }) =>
      recordDiagnostic({
        timestamp,
        name: 'mcp.request.trace',
        category: 'mcp',
        level: failed ? 'warning' : 'debug',
        attributes
      })
  })
  function runtime(event: string, attributes: DiagnosticAttributes = {}) {
    if (!enabled()) return
    try {
      const data = { event, ...context(), pendingRequests: trace.pendingCount, ...attributes }
      recordDiagnostic({
        name: 'mcp.runtime.state',
        category: 'mcp',
        level: event === 'scheduling-gap' ? 'warning' : 'debug',
        attributes: data
      })
      recordCanvasRuntimeEvent({ timestamp: Date.now(), ...data })
    } catch {
      console.warn('[MCP diagnostics] Could not record runtime state')
    }
  }
  const sample = () => ({ monotonic: performance.now(), wall: Date.now() })
  let last = sample()
  const timer = useIntervalFn(
    () => {
      const next = sample()
      const gap = schedulingGap(last, next, SAMPLE_INTERVAL_MS)
      if (gap.delayMs >= STALL_THRESHOLD_MS) runtime('scheduling-gap', gap)
      last = next
    },
    SAMPLE_INTERVAL_MS,
    { immediate: enabled() }
  )
  const visibility = () => runtime('visibility')
  const focus = () => runtime('focus')
  const blur = () => runtime('blur')
  const show = () => runtime('pageshow')
  const hide = () => runtime('pagehide')
  document.addEventListener('visibilitychange', visibility)
  window.addEventListener('focus', focus)
  window.addEventListener('blur', blur)
  window.addEventListener('pageshow', show)
  window.addEventListener('pagehide', hide)
  const stopDocument = watch(
    () => getStore(),
    () =>
      runtime('active-document', {
        documentSequence: ++documentSequence
      })
  )
  const stopPage = watch(
    () => getStore().state.currentPageId,
    () => runtime('active-page')
  )
  const stopEnabled = watch(enabled, (value) => {
    configure(value)
    if (!value) {
      trace.clear()
      timer.pause()
    } else {
      last = sample()
      timer.resume()
    }
  })
  return {
    trace,
    enabled,
    runtime,
    dispose() {
      disposed = true
      timer.pause()
      stopDocument()
      stopPage()
      stopEnabled()
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('focus', focus)
      window.removeEventListener('blur', blur)
      window.removeEventListener('pageshow', show)
      window.removeEventListener('pagehide', hide)
      trace.clear()
    }
  }
}
