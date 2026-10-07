import 'fake-indexeddb/auto'
import { expect, test } from 'bun:test'

import { acpChatThinkingState } from '@/app/ai/chat/acp-thinking'
import { modelSettingsSnapshot } from '@/app/ai/models'
import { createEditorStore } from '@/app/editor/session/create'

test('thinking choices are isolated by document and replaced profiles ignore late catalogs', () => {
  const first = createEditorStore()
  const second = createEditorStore()
  try {
    const profile = modelSettingsSnapshot().models.at(0)
    if (!profile) throw new Error('Missing default profile')
    const old = acpChatThinkingState(first, profile)
    old.choice.value = { configId: 'effort', value: 'deep' }
    expect(acpChatThinkingState(second, profile).choice.value).toBeUndefined()
    const current = acpChatThinkingState(first, { ...profile, modelID: 'new-model' })
    old.publish({ models: [], currentModelId: 'stale', selector: null })
    expect(current.catalog.value).toBeUndefined()
    expect(current.choice.value).toBeUndefined()
  } finally {
    first.dispose()
    second.dispose()
  }
})
