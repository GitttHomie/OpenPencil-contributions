import { expect, test } from 'bun:test'

import { toRaw } from 'vue'

import { parseIntegration } from '@/app/ai/acp/configuration/schema'
import { acpLaunchOptions } from '@/app/ai/acp/launch'
import {
  createModelProfileDraft,
  saveModelProfileDraft,
  parseAIModelSettings,
  aiModelSettings
} from '@/app/ai/models'

function configuration(names = ['AWS_REGION']) {
  return {
    version: 1,
    agent: 'claude-code',
    fields: [
      {
        id: 'region',
        label: 'Region',
        type: 'select',
        options: [{ value: 'eu-west-1', label: 'Europe' }],
        target: { kind: 'env', names }
      }
    ]
  }
}

test('team configuration restricts values and targets only the selected CLI', () => {
  const manifest = parseIntegration(JSON.stringify(configuration()))
  expect(acpLaunchOptions('claude-code', { region: 'eu-west-1' }, manifest)).toEqual({
    args: [],
    env: { AWS_REGION: 'eu-west-1' }
  })
  expect(acpLaunchOptions('claude-code', {}, manifest)).toEqual({ args: [], env: {} })
  expect(() => acpLaunchOptions('claude-code', { region: 'us-east-1' }, manifest)).toThrow()
  expect(() => acpLaunchOptions('codex', {}, manifest)).toThrow()
})

test('malformed and unsafe definitions are rejected before changing a profile', () => {
  for (const names of [
    ['PATH'],
    ['CODEX_HOME'],
    ['AWS_SECRET_ACCESS_KEY'],
    ['NODE_OPTIONS'],
    ['DYLD_INSERT_LIBRARIES']
  ]) {
    expect(() => parseIntegration(JSON.stringify(configuration(names)))).toThrow()
  }
  const duplicate = configuration()
  duplicate.fields.push(duplicate.fields[0])
  expect(() => parseIntegration(JSON.stringify(duplicate))).toThrow()
  expect(() => parseIntegration('{')).toThrow()
  expect(() => parseIntegration(JSON.stringify({ ...configuration(), command: 'sh' }))).toThrow()
  expect(() => parseIntegration(JSON.stringify({ ...configuration(), version: 2 }))).toThrow()
})

test('profile save and reopen preserve imported fields and session choices independently', () => {
  const previous = structuredClone(toRaw(aiModelSettings.value))
  try {
    const draft = createModelProfileDraft()
    draft.providerID = 'acp:claude-code'
    draft.name = 'Team model'
    draft.modelID = ''
    draft.acpIntegration = parseIntegration(JSON.stringify(configuration()))
    draft.acpLaunch = { region: 'eu-west-1' }
    draft.acpOptions = { speed: 'fast' }
    const saved = saveModelProfileDraft(draft)
    const reopened = createModelProfileDraft(saved.id)
    expect(reopened.acpIntegration).toEqual(draft.acpIntegration)
    expect(reopened.acpOptions).toEqual({ speed: 'fast' })
    const parsed = parseAIModelSettings(structuredClone(toRaw(aiModelSettings.value)))
    expect(parsed?.models.find((model) => model.id === saved.id)?.acpLaunch).toEqual({
      region: 'eu-west-1'
    })
    if (!reopened.acpIntegration) throw new Error('Missing configuration')
    reopened.acpIntegration.fields[0].label = 'Changed'
    expect(saved.acpIntegration?.fields[0].label).toBe('Region')
  } finally {
    aiModelSettings.value = previous
  }
})
