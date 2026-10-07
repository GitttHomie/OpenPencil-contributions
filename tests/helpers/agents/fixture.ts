import * as v from 'valibot'
import { createApp } from 'vue'

import { createRetainedScopePlugin } from '@open-pencil/vue'

import '@/app.css'
import { acpModelCatalogSchema } from '@/app/ai/acp/models'
import { createAgentDiscovery } from '@/app/ai/agents/discovery'
import { agentModelLoaderKey } from '@/app/ai/agents/models'
import { agentLookupSchema } from '@/app/ai/agents/native'
import { agentDiscoveryKey } from '@/app/ai/agents/use'
import { agentModelVerifierKey } from '@/app/ai/agents/verification'
import { MCP_INSTALL_TARGET } from '@/app/automation/mcp/failure'

import AgentSettingsFixture from './AgentSettingsFixture.vue'

const discovery = createAgentDiscovery({
  enabled: true,
  async lookup() {
    const response = await fetch('/__test/local-agents/lookup')
    if (!response.ok) throw new Error('Lookup failed')
    return v.parse(v.pipe(v.string(), v.parseJson(), agentLookupSchema), await response.text())
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
  .provide(agentModelVerifierKey, async (target, signal) => {
    const response = await fetch('/__test/local-agents/verify', {
      method: 'POST',
      body: JSON.stringify(target),
      signal
    })
    return v.parse(
      v.pipe(
        v.string(),
        v.parseJson(),
        v.union([
          v.object({ ok: v.literal(true) }),
          v.object({ ok: v.literal(false), reason: v.literal('model-not-found') })
        ])
      ),
      await response.text()
    )
  })
  .provide(agentModelLoaderKey, async (id, signal, modelId) => {
    const query = modelId ? `?model=${encodeURIComponent(modelId)}` : ''
    const response = await fetch(`/__test/local-agents/models/${id}${query}`, { signal })
    if (!response.ok) throw new Error('Model lookup failed')
    return v.parse(v.pipe(v.string(), v.parseJson(), acpModelCatalogSchema), await response.text())
  })
  .mount('#app')
