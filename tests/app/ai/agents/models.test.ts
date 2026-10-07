import { expect, test } from 'bun:test'

import { createAgentModelDiscovery } from '@/app/ai/agents/models'
import { createDeferred } from '@/app/runtime/deferred'

test('switching models reuses discovery; refresh and endpoint changes start a fresh process', async () => {
  let created = 0
  let destroyed = 0
  const selections: string[] = []
  const discovery = createAgentModelDiscovery(async () => {
    created++
    return {
      async listModels(id = '') {
        selections.push(id)
        return { models: [], currentModelId: id }
      },
      async destroy() {
        destroyed++
      }
    }
  })
  try {
    await discovery.load('codex', undefined, 'strong')
    await discovery.load('codex', undefined, 'fast')
    expect(created).toBe(1)
    expect(selections).toEqual(['strong', 'fast'])
    await discovery.load('codex', undefined, 'fast', undefined, true)
    expect(created).toBe(2)
    expect(destroyed).toBe(1)
    await discovery.load('codex', undefined, 'fast', { codexProvider: 'other' })
    expect(created).toBe(3)
    expect(destroyed).toBe(2)
  } finally {
    await discovery.dispose()
  }
  expect(destroyed).toBe(3)
})

test('cancelling pending discovery cannot kill the replacement session', async () => {
  const gate = createDeferred<{ models: never[]; currentModelId: string }>()
  const destroyed: number[] = []
  let created = 0
  const discovery = createAgentModelDiscovery(async () => {
    const id = ++created
    return {
      async listModels() {
        return id === 1 ? gate.promise : { models: [], currentModelId: 'new' }
      },
      async destroy() {
        destroyed.push(id)
      }
    }
  })
  const abort = new AbortController()
  const pending = discovery.load('codex', abort.signal).catch((error: unknown) => error)
  abort.abort()
  expect(await discovery.load('codex')).toMatchObject({ currentModelId: 'new' })
  expect(await pending).toBeInstanceOf(Error)
  expect(destroyed).not.toContain(2)
  await discovery.dispose()
  expect(destroyed).toContain(2)
  gate.resolve({ models: [], currentModelId: 'old' })
})
