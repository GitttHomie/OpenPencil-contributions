import { expect, test } from 'bun:test'

import { classifyAIChatError } from '@/app/ai/chat/failure'
import { MCPConnectionError } from '@/app/integrations/mcp/failure'
import { CredentialStoreError } from '@/app/settings/credentials/types'

test.each([
  "unexpected status 404 Not Found: The model 'provider.example-model' does not exist",
  "The model 'provider.example-model' was not found",
  'Unknown model: example-model'
])('CLI model failures expose model settings recovery: %s', (message) => {
  expect(classifyAIChatError(new Error(message))).toMatchObject({
    reason: 'model-not-found',
    detail: message
  })
})

test('a missing resource without a model error remains a generic failure', () => {
  expect(classifyAIChatError(new Error('Session does not exist')).reason).toBe('request-failed')
})

test('credential failures never expose raw backend details as chat error detail', () => {
  const error = new CredentialStoreError('locked', 'Sensitive backend detail')
  expect(classifyAIChatError(error)).toMatchObject({
    reason: 'credential-access',
    detail: undefined
  })
})

test('external connection failures identify the connection instead of blaming the canvas', () => {
  const error = new MCPConnectionError('Blender', new Error('Invalid saved environment'))
  expect(classifyAIChatError(error)).toMatchObject({
    reason: 'external-mcp',
    connectionName: 'Blender'
  })
})
