import { expect, test } from 'bun:test'

import type { SessionConfigOption } from '@agentclientprotocol/sdk'
import { reactive, ref } from 'vue'

import { ACP_AGENTS } from '@open-pencil/core/constants'

import {
  ACPConfigurationError,
  applySessionControls,
  sessionControls
} from '@/app/ai/acp/configuration/session'
import { sessionModelCatalog } from '@/app/ai/acp/models'
import { classifyConnectionError } from '@/app/ai/chat/connection-test'
import { classifyAIChatError } from '@/app/ai/chat/failure'
import { createModelProfileDraft } from '@/app/ai/models'
import { useProfileSessionOptions } from '@/app/ai/models/settings/profile-editor/session'

import { createConnectedAgent } from '#tests/helpers/agents/acp-session'

const option: SessionConfigOption = {
  id: 'speed',
  name: 'Response speed',
  type: 'select',
  currentValue: 'normal',
  options: [
    { value: 'normal', name: 'Normal' },
    { value: 'fast', name: 'Fast' }
  ]
}

test('agent-advertised options reach the UI and can be reset without saving a default override', () => {
  const draft = reactive(createModelProfileDraft())
  const catalog = ref(sessionModelCatalog({ configOptions: [option] }))
  const form = useProfileSessionOptions(
    draft,
    catalog,
    ref({ default: 'Default', unavailable: 'Unavailable' })
  )
  expect(form.controls.value[0].name).toBe('Response speed')
  form.update('speed', JSON.stringify(['fast']))
  expect(draft.acpOptions).toEqual({ speed: 'fast' })
  catalog.value = sessionModelCatalog({ configOptions: [] })
  expect(form.controls.value[0].invalid).toBe(true)
  form.update('speed', '__cli_default__')
  expect(draft.acpOptions).toBeUndefined()
  expect(form.controls.value).toEqual([])
})

test('missing, refused and conflicting options fail before inference', async () => {
  const controls = sessionControls([option])
  const connection = { setSessionConfigOption: async () => ({ configOptions: [option] }) }
  await expect(
    applySessionControls(connection, 'session', controls, { speed: 'removed' })
  ).rejects.toThrow('no longer available')
  await expect(
    applySessionControls(connection, 'session', controls, { speed: 'fast' })
  ).rejects.toThrow('did not apply')
  await expect(
    applySessionControls(connection, 'session', controls, { mode: 'auto-approve' })
  ).rejects.toThrow('no longer available')
  expect(sessionControls([{ ...option, category: 'mode' }])).toEqual([])
})

for (const purpose of ['design', 'review', 'verification'] as const) {
  test(`${purpose} applies discovered choices before the first request`, async () => {
    const agent = createConnectedAgent(
      ACP_AGENTS[0],
      false,
      undefined,
      purpose === 'review',
      false,
      {
        purpose: purpose === 'verification' ? 'verification' : undefined,
        controls: [option],
        sessionValues: { speed: 'fast' },
        responseText: 'OK'
      }
    )
    try {
      if (purpose === 'verification') await agent.transport.verifyModel()
      else {
        const stream = await agent.transport.sendMessages({
          chatId: 'test',
          trigger: 'submit-message',
          messages: [
            { id: 'user', role: 'user', parts: [{ type: 'text', text: 'Inspect selection' }] }
          ]
        })
        for await (const _chunk of stream) {
          /* Consume the request. */
        }
      }
      expect(agent.modelEvents.indexOf('option:speed:fast')).toBeLessThan(
        agent.modelEvents.indexOf('prompt:strong')
      )
      expect(agent.prompts).toHaveLength(1)
    } finally {
      await agent.dispose()
    }
  })
}

test('metadata discovery applies custom controls and restores defaults without inference', async () => {
  const agent = createConnectedAgent(ACP_AGENTS[0], false, undefined, false, false, {
    purpose: 'catalog',
    controls: [option]
  })
  try {
    expect(
      (await agent.transport.listModels('', { speed: 'fast' })).controls?.[0].currentValue
    ).toBe('fast')
    expect((await agent.transport.listModels()).controls?.[0].currentValue).toBe('normal')
    expect(agent.sessions).toHaveLength(1)
    expect(agent.prompts).toEqual([])
  } finally {
    await agent.dispose()
  }
})

test('a session option cannot silently replace the selected model', async () => {
  const agent = createConnectedAgent(ACP_AGENTS[0], false, undefined, false, false, {
    purpose: 'verification',
    modelId: 'strong',
    controls: [option],
    sessionValues: { speed: 'fast' },
    modelOnControlChange: 'fast'
  })
  try {
    await expect(agent.transport.verifyModel()).rejects.toThrow('changed the selected model')
    expect(agent.prompts).toEqual([])
  } finally {
    await agent.dispose()
  }
})

test('configuration errors lead to settings guidance in chat and verification', () => {
  const error = new ACPConfigurationError('Choose an available option.')
  expect(classifyAIChatError(error).reason).toBe('cli-configuration')
  expect(classifyConnectionError(error)).toBe('invalid-options')
})
