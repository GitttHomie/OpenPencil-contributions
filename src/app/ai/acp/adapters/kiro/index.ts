import * as v from 'valibot'

import { createCanvasPermissionScope } from '@/app/ai/acp/canvas/permissions'

import type { ACPAgentAdapter } from '../types'
import instructions from './instructions.md?raw'
import { kiroCanvasToolName } from './permissions'
import { createKiroCanvasReadiness } from './readiness'

const cloudConfigSetupSchema = v.object({
  kind: v.literal('other'),
  rawInput: v.nullish(v.never()),
  _meta: v.object({
    kiro: v.object({
      toolId: v.literal('fetch_cloud_config'),
      serverName: v.optional(v.never())
    })
  })
})

export const kiroAdapter: ACPAgentAdapter = {
  id: 'kiro-cli',
  instructions,
  isSetupTool: (tool) => v.safeParse(cloudConfigSetupSchema, tool).success,
  toolPresentation: {
    kiro_powers: { label: 'kiroExtensions', description: 'kiroExtensionsHint' },
    tool_load: { label: 'loadAgentTools' }
  },
  createSession({ purpose, mcpServers }) {
    const hasCanvas =
      purpose === 'design' &&
      mcpServers[0]?.name === 'open-pencil' &&
      mcpServers.filter((server) => server.name === 'open-pencil').length === 1
    const readiness = createKiroCanvasReadiness(hasCanvas)
    return {
      permissions: createCanvasPermissionScope(
        hasCanvas ? kiroCanvasToolName : undefined,
        'kiro-cli'
      ),
      ready: readiness.wait,
      notification: async (method, params) => {
        if (method === '_kiro/mcp/status') readiness.observe(params)
      }
    }
  }
}
