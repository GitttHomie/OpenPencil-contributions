import { expect, test } from 'bun:test'

import { ACP_AGENTS } from '@open-pencil/core/constants'

import { createConnectedAgent } from '#tests/helpers/agents/acp-session'

for (const agentDef of ACP_AGENTS) {
  test(`${agentDef.name} verification runs the selected model without canvas access`, async () => {
    const agent = createConnectedAgent(agentDef, false, undefined, true, false, {
      purpose: 'verification',
      modelId: 'fast',
      responseText: 'OK'
    })
    try {
      await agent.transport.verifyModel()
      expect(agent.modelEvents).toEqual(['select:fast', 'prompt:fast'])
      expect(agent.sessions[0].mcpServers).toEqual([])
      expect(agent.permissions).toEqual([{ outcome: { outcome: 'cancelled' } }])
      expect(agent.images).toEqual([])
    } finally {
      await agent.dispose()
    }
  })
}

test('verification rejects an advertised model that fails at inference', async () => {
  const codex = ACP_AGENTS.find((agent) => agent.id === 'codex')
  if (!codex) throw new Error('Codex adapter missing')
  const agent = createConnectedAgent(codex, false, undefined, false, false, {
    purpose: 'verification',
    modelId: 'fast',
    responseText:
      "unexpected status 404 Not Found: The model 'fast' does not exist, url: https://example.test/responses, request id: test"
  })
  try {
    await expect(agent.transport.verifyModel()).rejects.toThrow('does not exist')
  } finally {
    await agent.dispose()
  }
})

for (const responseText of ['', 'Unable to access the selected model.']) {
  test(`verification rejects a non-answer: ${responseText || 'empty'}`, async () => {
    const agent = createConnectedAgent(ACP_AGENTS[0], false, undefined, false, false, {
      purpose: 'verification',
      responseText
    })
    try {
      await expect(agent.transport.verifyModel()).rejects.toThrow('verification')
    } finally {
      await agent.dispose()
    }
  })
}

test('reused discovery can return to the original CLI default model', async () => {
  const agent = createConnectedAgent(ACP_AGENTS[0], false, undefined, false, false, {
    purpose: 'catalog'
  })
  try {
    expect((await agent.transport.listModels('fast')).currentModelId).toBe('fast')
    expect((await agent.transport.listModels()).currentModelId).toBe('strong')
    expect(agent.sessions).toHaveLength(1)
    expect(agent.prompts).toEqual([])
  } finally {
    await agent.dispose()
  }
})

test('destroying a verification session settles the pending request', async () => {
  const agent = createConnectedAgent(ACP_AGENTS[0], true, undefined, false, false, {
    purpose: 'verification',
    responseText: 'OK'
  })
  const pending = agent.transport.verifyModel().catch((error: unknown) => error)
  await agent.started
  await agent.dispose()
  expect(await pending).toBeInstanceOf(Error)
})
