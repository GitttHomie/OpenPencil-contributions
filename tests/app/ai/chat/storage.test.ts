import 'fake-indexeddb/auto'
import { expect, test } from 'bun:test'

import { effectScope, nextTick } from 'vue'

import { registerAIChatEffects } from '@/app/ai/chat/storage'
import {
  createModelProfileDraft,
  modelSettingsSnapshot,
  replaceAIModelSettings,
  saveModelProfileDraft,
  setModelRoleAssignment
} from '@/app/ai/models'

test('saving ACP thinking on the same model refreshes the transport for the next message', async () => {
  const original = modelSettingsSnapshot()
  const scope = effectScope()
  try {
    const profile = saveModelProfileDraft({
      ...createModelProfileDraft(),
      providerID: 'acp:codex',
      name: 'CLI',
      modelID: 'test-model',
      customModelID: ''
    })
    setModelRoleAssignment('design', profile.id)
    await nextTick()
    let dirty = 0
    scope.run(() =>
      registerAIChatEffects(() => {
        dirty++
      })
    )
    const draft = createModelProfileDraft(profile.id)
    draft.acpThinking = { configId: 'effort', value: 'deep' }
    saveModelProfileDraft(draft)
    await nextTick()
    expect(dirty).toBe(1)
  } finally {
    scope.stop()
    replaceAIModelSettings(original)
  }
})
