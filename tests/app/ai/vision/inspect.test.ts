import { expect, test } from 'bun:test'

import type { UIMessageChunk } from 'ai'

import type { ACPModelRuntime } from '@/app/ai/models/runtime'
import { inspectImages, type InspectionDependencies } from '@/app/ai/vision/inspect'

const runtime: ACPModelRuntime = {
  kind: 'acp',
  role: {
    requestedRole: 'vision',
    connection: {
      id: 'connection',
      providerID: 'acp:codex',
      customBaseURL: '',
      customAPIType: 'responses',
      credentialProfileId: 'unused'
    },
    profile: {
      id: 'model-test',
      connectionId: 'connection',
      name: 'Test',
      modelID: 'test',
      customModelID: '',
      capabilities: ['vision'],
      maxOutputTokens: 1200,
      thinkingLevel: 'default'
    }
  }
}

for (const imageIncluded of [true, false]) {
  test(`isolated CLI inspection requires confirmed image delivery: ${imageIncluded}`, async () => {
    let destroyed = 0
    let received = 0
    const dependencies: InspectionDependencies = {
      inspect: async () => {
        throw new Error('API runtime must not be used for a CLI')
      },
      createAgent: async (_runtime, images) => {
        received = images.length
        return {
          imageIncluded,
          destroy: async () => {
            destroyed++
          },
          sendMessages: async () =>
            new ReadableStream<UIMessageChunk>({
              start(controller) {
                controller.enqueue({
                  type: 'text-delta',
                  id: 'review',
                  delta: 'The heading is clipped.'
                })
                controller.close()
              }
            })
        }
      }
    }
    const pending = inspectImages(
      runtime,
      'Inspect these.',
      [
        { data: new Uint8Array([1]), mediaType: 'image/png' },
        { data: new Uint8Array([2]), mediaType: 'image/jpeg' }
      ],
      dependencies
    )
    if (imageIncluded) expect(await pending).toBe('The heading is clipped.')
    else await expect(pending).rejects.toThrow('did not receive')
    expect(received).toBe(2)
    expect(destroyed).toBe(1)
  })
}

test('an aborted inspection never starts the CLI', async () => {
  let created = false
  const dependencies: InspectionDependencies = {
    inspect: async () => {
      throw new Error('Unexpected API call')
    },
    createAgent: async () => {
      created = true
      throw new Error('Unexpected CLI')
    }
  }
  const controller = new AbortController()
  controller.abort()
  await expect(
    inspectImages(
      runtime,
      'Inspect.',
      [{ data: new Uint8Array([1]), mediaType: 'image/png' }],
      dependencies,
      controller.signal
    )
  ).rejects.toThrow()
  expect(created).toBe(false)
})
