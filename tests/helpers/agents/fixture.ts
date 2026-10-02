import { createApp } from 'vue'

import { createRetainedScopePlugin } from '@open-pencil/vue'

import '@/app.css'
import { createAgentDiscovery } from '@/app/ai/agents/discovery'
import type { AgentLookup } from '@/app/ai/agents/native'
import { agentDiscoveryKey } from '@/app/ai/agents/use'
import { MCP_INSTALL_TARGET } from '@/app/automation/mcp/failure'

import AgentSettingsFixture from './AgentSettingsFixture.vue'

const discovery = createAgentDiscovery({
  enabled: true,
  async lookup() {
    const response = await fetch('/__test/local-agents/lookup')
    if (!response.ok) throw new Error('Lookup failed')
    return response.json() as Promise<AgentLookup>
  },
  async install(agent) {
    const response = await fetch('/__test/local-agents/install', {
      method: 'POST',
      body: JSON.stringify({ id: agent.id, package: agent.adapterPackage })
    })
    if (!response.ok) throw new Error('Install failed')
  },
  async installBridge() {
    const response = await fetch('/__test/local-agents/install', {
      method: 'POST',
      body: JSON.stringify({ id: 'canvas', package: MCP_INSTALL_TARGET })
    })
    if (!response.ok) throw new Error('Install failed')
  },
  async restartBridge() {
    const response = await fetch('/__test/local-agents/restart', { method: 'POST' })
    if (!response.ok) throw new Error('Restart failed')
  }
})
createApp(AgentSettingsFixture)
  .use(createRetainedScopePlugin())
  .provide(agentDiscoveryKey, discovery)
  .mount('#app')
