import { ACP_AGENTS, type ACPAgentID } from '@open-pencil/core/constants'

import {
  aiModelSettings,
  createModelProfileDraft,
  modelConnection,
  saveModelProfileDraft,
  setModelRoleAssignment
} from '@/app/ai/models/store'

export function useAgentForDesign(id: ACPAgentID): void {
  const agent = ACP_AGENTS.find((definition) => definition.id === id)
  if (!agent) return
  const providerID = `acp:${id}` as const
  const existing = aiModelSettings.value.models.find(
    (profile) =>
      modelConnection(profile.connectionId)?.providerID === providerID &&
      profile.capabilities.includes('tools')
  )
  const profile =
    existing ??
    saveModelProfileDraft({
      ...createModelProfileDraft(),
      name: agent.name,
      providerID,
      sourceConnectionId: null,
      modelID: '',
      customModelID: '',
      customBaseURL: '',
      customAPIType: 'completions',
      reasoningEffort: '',
      capabilities: ['tools']
    })
  setModelRoleAssignment('design', profile.id)
}
