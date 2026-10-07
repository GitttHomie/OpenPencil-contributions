import 'fake-indexeddb/auto'
import { expect, spyOn, test } from 'bun:test'

import { simulateReadableStream } from 'ai'
import { MockLanguageModelV4 } from 'ai/test'
import { toRaw } from 'vue'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { getTextMeasurer, setTextMeasurer } from '@open-pencil/core/layout'

import { createToolLoopTransport } from '@/app/ai/chat/transports'
import { runPageId } from '@/app/ai/tools'
import { aiToolOverrides } from '@/app/ai/tools/preferences'
import * as figmaFactory from '@/app/automation/bridge/figma-factory'
import { createEditorStore } from '@/app/editor/session/create'
import { presenceOf } from '@/app/presence/registry'
import { appPreferences } from '@/app/settings/preferences/store'

import { MOCK_USAGE } from '#tests/helpers/chat/usage'

type EditorStore = ReturnType<typeof createEditorStore>
type Step = { toolName: string; input: unknown } | ((store: EditorStore) => Promise<void>)

/** Run one message whose model calls `steps` in order: a tool call, or a user action first. */
async function runMessage(store: EditorStore, steps: Step[]) {
  let call = 0
  const model = new MockLanguageModelV4({
    doStream: async () => {
      let step = steps[call++]
      while (typeof step === 'function') {
        await step(store)
        step = steps[call++]
      }
      const chunks = step
        ? [
            {
              type: 'tool-call' as const,
              toolCallId: `call-${call}`,
              toolName: step.toolName,
              input: JSON.stringify(step.input)
            },
            {
              type: 'finish' as const,
              finishReason: { unified: 'tool-calls' as const, raw: undefined },
              usage: MOCK_USAGE
            }
          ]
        : [
            {
              type: 'finish' as const,
              finishReason: { unified: 'stop' as const, raw: undefined },
              usage: MOCK_USAGE
            }
          ]
      return {
        stream: simulateReadableStream({ initialDelayInMs: null, chunkDelayInMs: null, chunks })
      }
    }
  })
  const transport = createToolLoopTransport({
    store,
    providerID: 'openai',
    model,
    effectiveModelID: 'test',
    maxOutputTokens: 100,
    thinkingLevel: () => 'default'
  })
  const stream = await transport.sendMessages({
    trigger: 'submit-message',
    chatId: 'run-page',
    messageId: undefined,
    messages: [{ id: 'user', role: 'user', parts: [{ type: 'text', text: 'Draw' }] }]
  })
  const reader = stream.getReader()
  try {
    while (!(await reader.read()).done);
  } finally {
    reader.releaseLock()
  }
}

async function withStore(
  check: (store: EditorStore, pages: { a: string; b: string }) => Promise<void>
) {
  const previousPreferences = structuredClone(toRaw(appPreferences.value))
  const previousTools = aiToolOverrides.value
  const store = createEditorStore()
  // Viewport DOM plumbing is outside this contract; keep the page the tools are given.
  const factory = spyOn(figmaFactory, 'makeFigmaFromStore').mockImplementation((editor, pageId) => {
    const api = new FigmaAPI(editor.graph)
    api.currentPage = api.wrapNode(pageId ?? editor.state.currentPageId)
    return api
  })
  // No canvas presents frames here; treat every page switch as presented.
  store.preparationController.acknowledgePresentation(Number.MAX_SAFE_INTEGER)
  try {
    aiToolOverrides.value = { create_shape: true, switch_page: true }
    const a = store.state.currentPageId
    const b = store.graph.addPage('B').id
    await check(store, { a, b })
  } finally {
    appPreferences.value = previousPreferences
    aiToolOverrides.value = previousTools
    factory.mockRestore()
    store.dispose()
  }
}

const rectangle = {
  toolName: 'create_shape',
  input: { type: 'RECTANGLE', x: 0, y: 0, width: 10, height: 10 }
}

test('chat authors exposed properties, resizes instance text and records undo', async () => {
  const previousMeasurer = getTextMeasurer()
  setTextMeasurer((node, maxWidth) => ({ width: maxWidth ?? node.text.length * 8, height: 16 }))
  try {
    await withStore(async (store, { a }) => {
      const component = store.graph.createNode('COMPONENT', a, {
        name: 'Button',
        layoutMode: 'HORIZONTAL',
        primaryAxisSizing: 'HUG',
        counterAxisSizing: 'HUG'
      })
      const label = store.graph.createNode('TEXT', component.id, {
        name: 'Label',
        text: 'Go',
        textAutoResize: 'WIDTH_AND_HEIGHT'
      })
      const instance = store.graph.createInstance(component.id, a)
      if (!instance) throw new Error('Missing instance')
      await runMessage(store, [
        {
          toolName: 'create_component_property',
          input: { owner_id: component.id, name: 'Caption', type: 'TEXT', default_value: 'Go' }
        }
      ])
      const property = component.componentPropertyDefinitions[0]
      if (!property) throw new Error('Chat did not create the property')
      await runMessage(store, [
        {
          toolName: 'bind_component_property',
          input: { id: label.id, field: 'TEXT', property_id: property.id }
        }
      ])
      expect(label.componentPropertyReferences).toEqual([
        { propertyId: property.id, field: 'TEXT' }
      ])
      const beforeWidth = instance.width
      store.undo.clear()
      await runMessage(store, [
        {
          toolName: 'set_instance_properties',
          input: { id: instance.id, values: { [property.id]: 'Continue to checkout' } }
        }
      ])
      expect(store.graph.getChildren(instance.id)[0].text).toBe('Continue to checkout')
      expect(instance.width).toBeGreaterThan(beforeWidth)
      expect(label.text).toBe('Go')
      store.undo.undo()
      expect(store.graph.getChildren(instance.id)[0].text).toBe('Go')
      expect(store.graph.getNode(instance.id)?.width).toBe(beforeWidth)
      store.undo.redo()
      expect(store.graph.getChildren(instance.id)[0].text).toBe('Continue to checkout')
    })
  } finally {
    setTextMeasurer(previousMeasurer)
  }
})

test('a run keeps working on its page while the user views another', async () => {
  await withStore(async (store, { a, b }) => {
    await runMessage(store, [(editor) => editor.switchPage(b), rectangle])

    expect(store.state.currentPageId).toBe(b)
    expect(runPageId(store)).toBe(a)
    expect(store.graph.getChildren(a)).toHaveLength(1)
    expect(store.graph.getChildren(b)).toHaveLength(0)

    // Undo restores the page the tool changed, not the page on screen.
    store.undo.undo()
    expect(store.graph.getChildren(a)).toHaveLength(0)
    expect(store.state.currentPageId).toBe(b)
  })
})

test("the agent's switch_page moves the run and the user's view", async () => {
  await withStore(async (store, { b }) => {
    await runMessage(store, [{ toolName: 'switch_page', input: { page: b } }, rectangle])

    expect(runPageId(store)).toBe(b)
    expect(store.graph.getChildren(b)).toHaveLength(1)
    expect(presenceOf(store).agents.value[0]?.pageId).toBe(b)
    expect(store.state.currentPageId).toBe(b)
  })
})

test('a run falls back to the page on screen when its page is deleted', async () => {
  await withStore(async (store, { a, b }) => {
    await runMessage(store, [])
    expect(runPageId(store)).toBe(a)
    await store.switchPage(b)
    store.graph.deleteNode(a)
    expect(runPageId(store)).toBe(b)
  })
})

test("shows the chat's agent where its tools work, then takes it off the canvas", async () => {
  await withStore(async (store, { a }) => {
    let during: ReturnType<typeof presenceOf>['agents']['value'] = []
    await runMessage(store, [
      rectangle,
      async (editor) => {
        during = presenceOf(editor).agents.value
      }
    ])
    const [shape] = store.graph.getChildren(a)
    expect(during).toMatchObject([
      { kind: 'chat', status: 'editing', cursor: { x: shape?.x, y: shape?.y, pageId: a } }
    ])
    expect(presenceOf(store).agents.value).toMatchObject([
      { name: during[0]?.name, status: 'idle', cursor: undefined }
    ])
  })
})
