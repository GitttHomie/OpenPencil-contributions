import 'fake-indexeddb/auto'
import { expect, test, spyOn } from 'bun:test'

import { generateText } from 'ai'
import { MockLanguageModelV4 } from 'ai/test'

import type { DirectAIModelRuntime } from '@/app/ai/models'
import { reviewDesign, DesignReviewError } from '@/app/ai/review/run'
import { captureReviewSnapshot } from '@/app/ai/review/snapshot'
import { createEditorStore } from '@/app/editor/session/create'

import { MOCK_USAGE } from '#tests/helpers/chat/usage'

function reviewer(vision = false): DirectAIModelRuntime {
  return {
    kind: 'direct',
    model: new MockLanguageModelV4({
      doGenerate: async () => ({
        content: [{ type: 'text', text: 'Make the primary action label more specific.' }],
        finishReason: { unified: 'stop', raw: undefined },
        usage: MOCK_USAGE,
        warnings: []
      })
    }),
    role: {
      requestedRole: 'review',
      profile: {
        id: 'model-review-test',
        name: 'Reviewer',
        connectionId: 'review-test',
        modelID: 'test',
        customModelID: '',
        maxOutputTokens: 4000,
        thinkingLevel: 'high',
        capabilities: vision ? ['vision'] : []
      },
      connection: {
        id: 'review-test',
        providerID: 'openai',
        customBaseURL: '',
        customAPIType: 'completions',
        credentialProfileId: 'review-test'
      }
    }
  }
}

for (const vision of [false, true]) {
  test(`review uses the Review runtime with no tools and image capability ${vision}`, async () => {
    const store = createEditorStore()
    const runtime = reviewer(vision)
    const model = runtime.model as MockLanguageModelV4
    const page = store.state.currentPageId
    const frame = store.graph.createNode('FRAME', page, {
      name: 'Checkout',
      width: 3200,
      height: 2000
    })
    const unrelated = store.graph.createNode('FRAME', page, { name: 'Unrelated' })
    store.select([frame.id])
    const before = structuredClone([...store.graph.getAllNodes()])
    const image = spyOn(store, 'renderExportImage').mockResolvedValue(new Uint8Array([1, 2, 3]))
    const requested: string[] = []
    try {
      const result = await reviewDesign(
        store,
        { focus: 'Clarity', signal: new AbortController().signal },
        {
          createRuntime: async (role) => {
            requested.push(role)
            return runtime
          },
          generate: generateText,
          createAgent: async () => {
            throw new Error('API review must not launch a CLI')
          }
        }
      )
      expect(requested).toEqual(['review'])
      expect(result.profileName).toBe('Reviewer')
      expect(result.imageIncluded).toBe(vision)
      expect(result.nodeIds).toEqual([frame.id])
      expect(result.text).toContain('primary action')
      expect(model.doGenerateCalls[0].tools ?? []).toHaveLength(0)
      expect(model.doGenerateCalls[0].reasoning).toBe('high')
      expect(JSON.stringify(model.doGenerateCalls[0].prompt)).toContain('Checkout')
      expect(JSON.stringify(model.doGenerateCalls[0].prompt)).not.toContain(unrelated.name)
      expect([...store.graph.getAllNodes()]).toEqual(before)
      if (vision) expect(image).toHaveBeenCalledWith([frame.id], 0.5, 'PNG', page)
      else expect(image).not.toHaveBeenCalled()
    } finally {
      image.mockRestore()
      store.dispose()
    }
  })
}

test('empty pages and missing reviewers never issue a model request', async () => {
  const store = createEditorStore()
  const requested: string[] = []
  const dependencies = {
    createRuntime: async (role: 'design' | 'review' | 'fast' | 'vision') => {
      requested.push(role)
      return null
    },
    generate: generateText,
    createAgent: async () => {
      throw new Error('Must not launch')
    }
  }
  const request = { focus: '', signal: new AbortController().signal }
  try {
    await expect(reviewDesign(store, request, dependencies)).rejects.toEqual(
      new DesignReviewError('empty')
    )
    expect(requested).toEqual([])
    store.graph.createNode('FRAME', store.state.currentPageId)
    await expect(reviewDesign(store, request, dependencies)).rejects.toEqual(
      new DesignReviewError('unconfigured')
    )
    expect(requested).toEqual(['review'])
  } finally {
    store.dispose()
  }
})

test('snapshot bounds large pages and reports truncation', () => {
  const store = createEditorStore()
  try {
    for (let i = 0; i < 310; i++) store.graph.createNode('FRAME', store.state.currentPageId)
    const snapshot = captureReviewSnapshot(store)
    expect(snapshot.count).toBe(300)
    expect(JSON.parse(snapshot.text).truncated).toBe(true)
  } finally {
    store.dispose()
  }
})
