import { expect, test } from 'bun:test'

import type { SessionConfigOption } from '@agentclientprotocol/sdk'

import { applySessionThinking, sessionThinkingControl } from '@/app/ai/acp/thinking'

const config: SessionConfigOption = {
  id: 'effort-control',
  type: 'select',
  category: 'thought_level',
  name: 'Effort',
  currentValue: 'quick',
  options: [
    {
      group: 'effort',
      name: 'Effort',
      options: [
        { value: 'quick', name: 'Quick' },
        { value: 'thorough', name: 'Thorough' }
      ]
    }
  ]
}

test('reads agent-defined grouped thinking values without inventing universal levels', () => {
  expect(sessionThinkingControl([config])).toEqual({
    id: 'effort-control',
    name: 'Effort',
    currentValue: 'quick',
    options: [
      { value: 'quick', name: 'Quick' },
      { value: 'thorough', name: 'Thorough' }
    ]
  })
  expect(sessionThinkingControl([{ ...config, category: 'mode' }])).toBeUndefined()
})

test('rejects a config acknowledgement that did not activate the requested value', async () => {
  await expect(
    applySessionThinking(
      {
        async setSessionConfigOption() {
          return { configOptions: [config] }
        }
      },
      'session',
      sessionThinkingControl([config]),
      {
        configId: config.id,
        value: 'thorough'
      }
    )
  ).rejects.toThrow('did not activate')
})
