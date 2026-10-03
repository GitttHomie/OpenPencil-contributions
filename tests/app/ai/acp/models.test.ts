import { expect, test } from 'bun:test'

import type { SessionConfigOption } from '@agentclientprotocol/sdk'

import { applySessionModel, sessionModelCatalog } from '@/app/ai/acp/models'

function options(currentValue = 'strong'): SessionConfigOption[] {
  return [
    {
      type: 'select',
      id: 'backend-model',
      category: 'model',
      name: 'Model',
      currentValue,
      options: [
        {
          group: 'models',
          name: 'Models',
          options: [
            { value: 'fast', name: 'Fast' },
            { value: 'strong', name: 'Strong' }
          ]
        }
      ]
    }
  ]
}

test('uses semantic config selectors and grouped choices ahead of the legacy model list', async () => {
  const catalog = sessionModelCatalog({
    configOptions: options(),
    models: { currentModelId: 'legacy', availableModels: [{ modelId: 'legacy', name: 'Legacy' }] }
  })
  const calls: unknown[] = []
  const selected = await applySessionModel(
    {
      async setSessionConfigOption(request) {
        calls.push(request)
        return { configOptions: options(request.value) }
      },
      async unstable_setSessionModel() {
        throw new Error('Must prefer config options')
      }
    },
    'session',
    catalog,
    'fast'
  )
  expect(calls).toEqual([{ sessionId: 'session', configId: 'backend-model', value: 'fast' }])
  expect(selected.currentModelId).toBe('fast')
  expect(selected.models.map((model) => model.id)).toEqual(['fast', 'strong'])
})

test('supports legacy model selection and explicit CLI default without inventing choices', async () => {
  const catalog = sessionModelCatalog({
    models: {
      currentModelId: 'strong',
      availableModels: [
        { modelId: 'strong', name: 'Strong' },
        { modelId: 'fast', name: 'Fast' }
      ]
    }
  })
  const calls: unknown[] = []
  const connection = {
    async setSessionConfigOption() {
      throw new Error('No config selector')
    },
    async unstable_setSessionModel(request: { sessionId: string; modelId: string }) {
      calls.push(request)
      return {}
    }
  }
  await applySessionModel(connection, 'session', catalog, 'fast')
  expect(calls).toEqual([{ sessionId: 'session', modelId: 'fast' }])
  const unsupported = sessionModelCatalog({})
  expect(await applySessionModel(connection, 'session', unsupported, '')).toEqual(unsupported)
  await expect(applySessionModel(connection, 'session', unsupported, 'fast')).rejects.toThrow(
    'does not expose'
  )
  await expect(applySessionModel(connection, 'session', catalog, 'missing')).rejects.toThrow(
    'Model not found'
  )
  expect(calls).toHaveLength(1)
})

test('rejects an acknowledged config change that leaves the wrong model active', async () => {
  const catalog = sessionModelCatalog({ configOptions: options() })
  await expect(
    applySessionModel(
      {
        async setSessionConfigOption() {
          return { configOptions: options() }
        },
        async unstable_setSessionModel() {
          return {}
        }
      },
      'session',
      catalog,
      'fast'
    )
  ).rejects.toThrow('did not activate')
})
