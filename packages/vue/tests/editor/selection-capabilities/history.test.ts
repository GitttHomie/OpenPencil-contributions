import { expect, test } from 'bun:test'

import { createApp, effectScope, shallowRef } from 'vue'

import { createEditor } from '@open-pencil/core/editor'

import { EDITOR_KEY } from '#vue/editor/context'
import { useSelectionCapabilities } from '#vue/editor/selection-capabilities/use'

test('undo availability follows the active editor and its history events', () => {
  const first = createEditor()
  const second = createEditor()
  const active = shallowRef(first)
  const editor = new Proxy(first, {
    get: (_, property) => Reflect.get(active.value, property)
  })
  const app = createApp({})
  app.provide(EDITOR_KEY, editor)
  const scope = effectScope()
  try {
    const capabilities = scope.run(() => app.runWithContext(useSelectionCapabilities))
    if (!capabilities) throw new Error('Selection capabilities unavailable')
    expect(capabilities.canUndo.value).toBe(false)

    active.value = second
    second.createShape('FRAME', 0, 0, 100, 100)
    expect(capabilities.canUndo.value).toBe(true)
    second.undoAction()
    expect(capabilities.canUndo.value).toBe(false)
    expect(capabilities.canRedo.value).toBe(true)

    active.value = first
    expect(capabilities.canRedo.value).toBe(false)
    first.createShape('FRAME', 0, 0, 50, 50)
    expect(capabilities.canUndo.value).toBe(true)
    active.value = second
    expect(capabilities.canUndo.value).toBe(false)
    second.redoAction()
    expect(capabilities.canUndo.value).toBe(true)
    expect(capabilities.canRedo.value).toBe(false)
  } finally {
    scope.stop()
    first.dispose()
    second.dispose()
  }
})
