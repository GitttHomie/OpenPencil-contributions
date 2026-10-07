import type { UIMessage } from 'ai'
import { computed, shallowRef } from 'vue'

import { attachmentsForMessage } from '@/app/ai/attachment/presentation/store'
import { resolveAIModelRole } from '@/app/ai/models'
import { useActiveEditorStoreRef, type EditorStore } from '@/app/editor/active-store'

import { routingChoice, routingRequest } from './policy'
import { automaticRouting, LAYA_SUPPORTED } from './preferences'
import { layaStatus, predictLaya } from './runtime'
import { hasFastRoutingTarget } from './targets'

const decisions = new WeakMap<EditorStore, ReturnType<typeof decisionState>>()
function decisionState() {
  return shallowRef<{ role: 'fast' | 'design'; model: string } | null>(null)
}
function forStore(store: EditorStore) {
  let current = decisions.get(store)
  if (!current) {
    current = decisionState()
    decisions.set(store, current)
  }
  return current
}

export function useRoutingDecision() {
  const store = useActiveEditorStoreRef()
  return computed(() => (store.value ? forStore(store.value).value : null))
}

export function resetRoutingDecision(store: EditorStore) {
  forStore(store).value = null
}

export function routingOptions(store: EditorStore) {
  return {
    enabled: () => LAYA_SUPPORTED && automaticRouting.value && layaStatus.value.loaded,
    allows: (message: UIMessage) =>
      !attachmentsForMessage(message.id).value.some((attachment) => attachment.kind === 'image'),
    fastAvailable: hasFastRoutingTarget,
    async decide(text: string) {
      const nodes = [...store.state.selectedIds].slice(0, 8).flatMap((id) => {
        const node = store.graph.getNode(id)
        return node ? [{ type: node.type, name: node.name.slice(0, 80) }] : []
      })
      if (!nodes.length || store.state.selectedIds.size > 8) return 'design' as const
      return routingChoice(await predictLaya(routingRequest(text, nodes)))
    },
    selected(role: 'design' | 'fast') {
      const profile = resolveAIModelRole(role)?.profile
      if (profile && automaticRouting.value) forStore(store).value = { role, model: profile.name }
    }
  }
}
