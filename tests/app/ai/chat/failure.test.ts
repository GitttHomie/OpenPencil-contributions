import { expect, test } from 'bun:test'

import { classifyAIChatError } from '@/app/ai/chat/failure'

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
