import { expect, test } from 'bun:test'

import { reactive } from 'vue'

import { parseIntegration } from '@/app/ai/acp/configuration/schema'
import { acpLaunchOptions, parseACPLaunchSettings } from '@/app/ai/acp/launch'
import { createModelProfileDraft } from '@/app/ai/models'
import { useProfileLaunchSettings } from '@/app/ai/models/settings/profile-editor/launch'

test('imported fields flow from the profile editor into launch mappings without adapter changes', () => {
  const draft = reactive(createModelProfileDraft())
  draft.providerID = 'acp:gemini-cli'
  draft.acpIntegration = parseIntegration(
    JSON.stringify({
      version: 1,
      agent: 'gemini-cli',
      fields: [
        {
          id: 'endpoint',
          label: 'Team endpoint',
          type: 'url',
          target: { kind: 'env', names: ['TEAM_ENDPOINT'] }
        }
      ]
    })
  )
  draft.acpLaunch = { retainedSetting: 'preserve' }
  const form = useProfileLaunchSettings(draft)
  form.updateField('endpoint', 'https://example.test/custom')
  form.updateField('unknown', 'ignore')
  expect(draft.acpLaunch).toEqual({
    retainedSetting: 'preserve',
    endpoint: 'https://example.test/custom'
  })
  expect(acpLaunchOptions('gemini-cli', draft.acpLaunch, draft.acpIntegration)).toEqual({
    args: [],
    env: { TEAM_ENDPOINT: 'https://example.test/custom' }
  })
  form.updateField('endpoint', 'https://user:secret@example.test')
  expect(form.valid.value).toBe(false)
  expect(form.errors.value.endpoint).toBeDefined()
})

test('profile fields follow the selected adapter and never supply endpoint or region defaults', () => {
  const draft = reactive(createModelProfileDraft())
  draft.providerID = 'acp:claude-code'
  draft.acpLaunch = undefined
  const form = useProfileLaunchSettings(draft)
  form.updateField('awsRegion', 'eu-west-1')
  expect(acpLaunchOptions('claude-code', draft.acpLaunch).env).toEqual({
    AWS_REGION: 'eu-west-1',
    AWS_DEFAULT_REGION: 'eu-west-1'
  })
  form.updateField('awsRegion', '')
  expect(acpLaunchOptions('claude-code', draft.acpLaunch)).toEqual({ args: [], env: {} })
  draft.providerID = 'acp:kiro-cli'
  expect(form.fields.value).toEqual([])
  form.updateField('awsRegion', 'us-east-1')
  expect(draft.acpLaunch.awsRegion).toBe('')
})

test('saved adapter values retain both previous field IDs and newly defined fields', () => {
  const saved = {
    codexProvider: 'bedrock',
    codexBaseURL: 'https://example.test',
    futureField: 'value'
  }
  expect(parseACPLaunchSettings(saved)).toEqual(saved)
  expect(parseACPLaunchSettings({ futureField: 42 })).toBeUndefined()
})
