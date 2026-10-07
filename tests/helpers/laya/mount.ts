import { createApp } from 'vue'

import { createRetainedScopePlugin } from '@open-pencil/vue'

import '@/app.css'
import {
  aiModelSettings,
  createModelProfileDraft,
  saveModelProfileDraft,
  setModelRoleAssignment
} from '@/app/ai/models'

import LayaSettingsFixture from './LayaSettingsFixture.vue'

if (!aiModelSettings.value.models.some((profile) => profile.name === 'Test fast model')) {
  const fast = saveModelProfileDraft({
    ...createModelProfileDraft(),
    name: 'Test fast model',
    providerID: 'acp:codex',
    modelID: 'test-fast',
    capabilities: ['tools']
  })
  setModelRoleAssignment('fast', fast.id)
}
createApp(LayaSettingsFixture).use(createRetainedScopePlugin()).mount('#app')
