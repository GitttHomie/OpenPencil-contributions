import { afterEach, beforeEach, expect, test } from 'bun:test'

import { useAgentForDesign } from '@/app/ai/agents/profiles'
import {
  aiModelSettings,
  modelSettingsSnapshot,
  replaceAIModelSettings,
  resolveAIModelRole
} from '@/app/ai/models/store'
import type { AIModelSettings } from '@/app/ai/models/types'

let original: AIModelSettings
beforeEach(() => {
  original = modelSettingsSnapshot()
})
afterEach(() => {
  replaceAIModelSettings(original)
})

test('selecting a detected agent creates one credential-free profile and reuses it', () => {
  const initialCount = aiModelSettings.value.models.length
  useAgentForDesign('kiro-cli')
  const selected = resolveAIModelRole('design')
  expect(selected?.connection.providerID).toBe('acp:kiro-cli')
  expect(selected?.profile.name).toBe('Kiro CLI')
  expect(selected?.profile.modelID).toBe('')
  expect(selected?.profile.capabilities).toEqual(['tools'])
  expect(aiModelSettings.value.models).toHaveLength(initialCount + 1)
  useAgentForDesign('kiro-cli')
  expect(aiModelSettings.value.models).toHaveLength(initialCount + 1)
  expect(resolveAIModelRole('design')?.profile.id).toBe(selected?.profile.id)
})

test('an agent can be inherited for Review but not for direct-only roles', () => {
  aiModelSettings.value.assignments.review = 'design'
  aiModelSettings.value.assignments.fast = aiModelSettings.value.assignments.design
  aiModelSettings.value.assignments.vision = 'design'
  const fast = aiModelSettings.value.assignments.fast
  useAgentForDesign('codex')
  expect(aiModelSettings.value.assignments.review).toBe('design')
  expect(resolveAIModelRole('review')?.connection.providerID).toBe('acp:codex')
  expect(aiModelSettings.value.assignments.vision).toBeNull()
  expect(aiModelSettings.value.assignments.fast).toBe(fast)
})
