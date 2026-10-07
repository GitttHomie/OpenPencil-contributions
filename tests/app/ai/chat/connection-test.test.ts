import { expect, spyOn, test } from 'bun:test'

import { testProviderConnection } from '@/app/ai/chat/connection-test'
import type { ModelConfig } from '@/app/ai/providers/types'

const config: ModelConfig = {
  providerID: 'openai-compatible',
  apiKey: 'test-key',
  modelID: 'custom',
  customModelID: 'anthropic.claude-sonnet-5',
  customBaseURL: 'https://provider.example/v1',
  customAPIType: 'responses'
}

test.each([
  {
    message: "The model 'anthropic.claude-sonnet-5' does not support the '/v1/responses' API",
    reason: 'api-type'
  },
  {
    message:
      "The model 'anthropic.claude-sonnet-5' does not support the '/v1/chat/completions' API",
    reason: 'api-type'
  },
  {
    message: "The model 'example-model' does not exist",
    reason: 'model-not-found'
  },
  {
    message: "Unknown model 'example-model' for the responses endpoint",
    reason: 'model-not-found'
  },
  {
    message: 'max_output_tokens exceeds the limit for this model',
    reason: 'unknown'
  }
])('connection test classifies provider rejection: $message', async ({ message, reason }) => {
  const fetch = spyOn(globalThis, 'fetch').mockResolvedValue(
    Response.json(
      { error: { message, type: 'invalid_request_error', code: 'validation_error', param: null } },
      { status: 400 }
    )
  )
  try {
    expect(await testProviderConnection(config)).toEqual({ ok: false, reason })
    expect(fetch).toHaveBeenCalledTimes(1)
  } finally {
    fetch.mockRestore()
  }
})
