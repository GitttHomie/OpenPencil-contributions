import { shallowRef } from 'vue'

import type { EditorStore } from '@/app/editor/active-store'

export type DesignCheckStatus = 'checking' | 'reviewed' | 'structure-only' | 'stale' | 'failed'

const states = new WeakMap<EditorStore, ReturnType<typeof createState>>()
function createState() {
  return {
    status: shallowRef<DesignCheckStatus | null>(null),
    readOnly: false,
    continuing: false,
    supportsImages: false
  }
}

export function designCheckState(store: EditorStore) {
  let state = states.get(store)
  if (!state) {
    state = createState()
    states.set(store, state)
    const captured = state
    const invalidate = () => {
      if (captured.status.value === 'reviewed' || captured.status.value === 'structure-only') {
        captured.status.value = 'stale'
      }
    }
    // The graph owns this listener, so closing the document releases it with the graph.
    store.graph.onNodeEvents({
      created: invalidate,
      updated: invalidate,
      deleted: invalidate,
      reparented: invalidate,
      reordered: invalidate
    })
  }
  return state
}
