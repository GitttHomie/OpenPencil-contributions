import { expect, test } from 'bun:test'

import type { SessionUpdate } from '@agentclientprotocol/sdk'

import { ACP_AGENTS } from '@open-pencil/core/constants'

import { createConnectedAgent } from '#tests/helpers/agents/acp-session'

const cloudConfigSetup: Extract<SessionUpdate, { sessionUpdate: 'tool_call' }> = {
  sessionUpdate: 'tool_call',
  toolCallId: 'cloud-config',
  title: 'Fetching your cloud config',
  kind: 'other',
  status: 'in_progress',
  _meta: { kiro: { toolId: 'fetch_cloud_config' } }
}

test('Kiro verification accepts its cloud configuration setup before a successful reply', async () => {
  const kiro = ACP_AGENTS.find((agent) => agent.id === 'kiro-cli')
  if (!kiro) throw new Error('Kiro adapter missing')
  const agent = createConnectedAgent(kiro, false, undefined, true, false, {
    purpose: 'verification',
    modelId: 'fast',
    responseText: 'OK',
    updates: [
      cloudConfigSetup,
      {
        sessionUpdate: 'tool_call_update',
        toolCallId: cloudConfigSetup.toolCallId,
        status: 'completed'
      }
    ]
  })
  try {
    await agent.transport.verifyModel()
    expect(agent.modelEvents).toEqual(['select:fast', 'prompt:fast'])
    expect(agent.sessions[0].mcpServers).toEqual([])
    expect(agent.permissions).toEqual([{ outcome: { outcome: 'cancelled' } }])
  } finally {
    await agent.dispose()
  }
})

for (const [name, update] of [
  [
    'an ordinary tool after setup',
    { ...cloudConfigSetup, _meta: { kiro: { toolId: 'read_file' } } }
  ],
  ['a matching title without metadata', { ...cloudConfigSetup, _meta: undefined }],
  ['a tool with arguments', { ...cloudConfigSetup, rawInput: { path: 'document.fig' } }],
  ['a file operation', { ...cloudConfigSetup, kind: 'read' }],
  [
    'an MCP tool',
    {
      ...cloudConfigSetup,
      _meta: { kiro: { toolId: 'fetch_cloud_config', serverName: 'external' } }
    }
  ]
] satisfies [string, SessionUpdate][]) {
  test(`Kiro verification still rejects ${name}`, async () => {
    const kiro = ACP_AGENTS.find((agent) => agent.id === 'kiro-cli')
    if (!kiro) throw new Error('Kiro adapter missing')
    const agent = createConnectedAgent(kiro, false, undefined, false, false, {
      purpose: 'verification',
      responseText: 'OK',
      updates: [cloudConfigSetup, update]
    })
    try {
      await expect(agent.transport.verifyModel()).rejects.toThrow('verification')
    } finally {
      await agent.dispose()
    }
  })
}

test('verification does not apply Kiro setup semantics to other agents', async () => {
  const agent = createConnectedAgent(ACP_AGENTS[0], false, undefined, false, false, {
    purpose: 'verification',
    responseText: 'OK',
    updates: [cloudConfigSetup]
  })
  try {
    await expect(agent.transport.verifyModel()).rejects.toThrow('verification')
  } finally {
    await agent.dispose()
  }
})

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

test('catalog reports image transport support without running inference', async () => {
  const agent = createConnectedAgent(ACP_AGENTS[0], false, undefined, false, true, {
    purpose: 'catalog'
  })
  try {
    expect((await agent.transport.listModels()).imageInput).toBe(true)
    expect(agent.prompts).toEqual([])
  } finally {
    await agent.dispose()
  }
})

for (const [supportsImages, answer, success] of [
  [true, '384729', true],
  [true, '000000', false],
  [false, '384729', false]
] as const) {
  test(`image verification requires image delivery and the right answer: ${supportsImages}/${answer}`, async () => {
    const agent = createConnectedAgent(ACP_AGENTS[0], false, undefined, false, supportsImages, {
      purpose: 'verification',
      responseText: answer
    })
    try {
      const result = agent.transport.verifyModel({ data: 'test-image', expected: '384729' })
      if (success) await result
      else await expect(result).rejects.toThrow()
      expect(agent.sessions[0].mcpServers).toEqual([])
      expect(agent.images).toEqual(supportsImages ? ['test-image'] : [])
      expect(agent.prompts.join(' ')).not.toContain('384729')
    } finally {
      await agent.dispose()
    }
  })
}

test('vision sessions deliver every image without attaching canvas tools or accepting permissions', async () => {
  const agent = createConnectedAgent(ACP_AGENTS[0], false, undefined, true, true, {
    purpose: 'vision',
    responseText: 'The right column is clipped.',
    images: [
      { data: 'first', mimeType: 'image/png' },
      { data: 'second', mimeType: 'image/jpeg' }
    ]
  })
  try {
    const stream = await agent.transport.sendMessages({
      chatId: 'vision',
      trigger: 'submit-message',
      messageId: undefined,
      abortSignal: undefined,
      messages: [{ id: 'request', role: 'user', parts: [{ type: 'text', text: 'Inspect both.' }] }]
    })
    for await (const chunk of stream) {
      expect(chunk.type).not.toBe('error')
    }
    expect(agent.transport.imageIncluded).toBe(true)
    expect(agent.images).toEqual(['first', 'second'])
    expect(agent.sessions[0].mcpServers).toEqual([])
    expect(agent.permissions).toEqual([{ outcome: { outcome: 'cancelled' } }])
  } finally {
    await agent.dispose()
  }
})
