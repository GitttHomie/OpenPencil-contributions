import { expect, test } from 'bun:test'

import { acpLaunchOptions, ACPLaunchSettingsError } from '@/app/ai/acp/launch'

test('CLI defaults are inherited unless an OpenPencil override is explicitly set', () => {
  for (const agent of ['codex', 'claude-code', 'kiro-cli', 'gemini-cli'] as const) {
    expect(acpLaunchOptions(agent)).toEqual({ args: [], env: {} })
  }
})

test('Codex overrides use its ACP adapter environment contract and retain the provider', () => {
  expect(
    acpLaunchOptions('codex', {
      codexProvider: 'bedrock',
      codexBaseURL: 'https://example.test/openai/v1'
    })
  ).toEqual({
    args: [],
    env: {
      CODEX_CONFIG: JSON.stringify({
        model_provider: 'bedrock',
        'model_providers.bedrock.base_url': 'https://example.test/openai/v1'
      }),
      MODEL_PROVIDER: 'bedrock'
    }
  })
  expect(
    acpLaunchOptions('claude-code', { awsRegion: 'us-east-1', codexProvider: 'bedrock' })
  ).toEqual({
    args: [],
    env: { AWS_REGION: 'us-east-1', AWS_DEFAULT_REGION: 'us-east-1' }
  })
  expect(acpLaunchOptions('kiro-cli', { awsRegion: 'us-east-1' })).toEqual({ args: [], env: {} })
})

test('Codex Bedrock region is configured independently of a custom endpoint', () => {
  expect(
    acpLaunchOptions('codex', { codexProvider: 'team-bedrock', awsRegion: 'us-east-1' })
  ).toEqual({
    args: [],
    env: {
      CODEX_CONFIG: JSON.stringify({
        model_provider: 'team-bedrock',
        'model_providers.team-bedrock.aws.region': 'us-east-1'
      }),
      MODEL_PROVIDER: 'team-bedrock'
    }
  })
  expect(() => acpLaunchOptions('codex', { awsRegion: 'us-east-1' })).toThrow(
    ACPLaunchSettingsError
  )
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
