import { computed, inject, onMounted, type InjectionKey } from 'vue'

import type { ACPAgentID } from '@open-pencil/core/constants'

import { designProviderID } from '@/app/ai/models/store'

import { agentDiscovery } from './discovery'
import { useAgentForDesign } from './profiles'

export const agentDiscoveryKey: InjectionKey<typeof agentDiscovery> = Symbol('agentDiscovery')

export function useLocalAgents() {
  const discovery = inject(agentDiscoveryKey, agentDiscovery)
  onMounted(() => {
    void discovery.refresh()
  })

  function select(id: ACPAgentID) {
    if (discovery.availableAgents.value.some((agent) => agent.definition.id === id)) {
      useAgentForDesign(id)
    }
  }

  return {
    ...discovery,
    desktop: discovery.supported,
    selectedProviderID: designProviderID,
    busy: computed(() => discovery.scanning.value || discovery.installing.value !== null),
    select
  }
}
