import { expect, test } from 'bun:test'

import { acpLaunchOptions, ACPLaunchSettingsError } from '@/app/ai/acp/launch'

test('CLI defaults are inherited unless an OpenPencil override is explicitly set', () => {
  for (const agent of ['codex', 'claude-code', 'kiro-cli', 'gemini-cli'] as const) {
    expect(acpLaunchOptions(agent)).toEqual({ args: [], env: {} })
  }
})

test('Codex endpoint overrides are literal process arguments and retain the existing provider', () => {
  expect(
    acpLaunchOptions('codex', {
      codexProvider: 'bedrock',
      codexBaseURL: 'https://example.test/openai/v1'
    })
  ).toEqual({
    args: [
      '-c',
      'model_provider="bedrock"',
      '-c',
      'model_providers.bedrock.base_url="https://example.test/openai/v1"'
    ],
    env: {}
  })
  expect(
    acpLaunchOptions('claude-code', { awsRegion: 'us-east-1', codexProvider: 'bedrock' })
  ).toEqual({
    args: [],
    env: { AWS_REGION: 'us-east-1', AWS_DEFAULT_REGION: 'us-east-1' }
  })
  expect(acpLaunchOptions('kiro-cli', { awsRegion: 'us-east-1' })).toEqual({ args: [], env: {} })
})

test('invalid or credential-bearing endpoint overrides cannot launch a process', () => {
  for (const launch of [
    { codexBaseURL: 'https://example.test' },
    { codexProvider: 'provider.other' },
    { codexProvider: 'bedrock', codexBaseURL: 'https://user:password@example.test' },
    { codexProvider: 'bedrock', codexBaseURL: 'https://example.test?token=secret' },
    { codexProvider: 'bedrock', codexBaseURL: 'file:///tmp/test' },
    { codexProvider: 'bedrock', codexBaseURL: 'https://example.test/path&command' },
    { codexProvider: 'bedrock', codexBaseURL: 'https://example.test/%VARIABLE%' }
  ])
    expect(() => acpLaunchOptions('codex', launch)).toThrow(ACPLaunchSettingsError)
  expect(() => acpLaunchOptions('claude-code', { awsRegion: 'invalid' })).toThrow(
    ACPLaunchSettingsError
  )
})
