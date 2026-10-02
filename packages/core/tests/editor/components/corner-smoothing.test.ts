import { expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { createEditor } from '@open-pencil/core/editor'

test('editing and undoing component smoothing propagates while retaining instance overrides', async () => {
  const editor = createEditor()
  try {
    const page = editor.state.currentPageId
    const component = editor.graph.createNode('COMPONENT', page, { cornerSmoothing: 0.5 })
    const inherited = expectDefined(editor.graph.createInstance(component.id, page))
    const overridden = expectDefined(editor.graph.createInstance(component.id, page))
    editor.updateNodeWithUndo(overridden.id, { cornerSmoothing: 0.2 })
    editor.updateNodeWithUndo(component.id, { cornerSmoothing: 1 })
    await Promise.resolve()
    expect(inherited.cornerSmoothing).toBe(1)
    expect(overridden.cornerSmoothing).toBe(0.2)
    editor.undoAction()
    await Promise.resolve()
    expect(inherited.cornerSmoothing).toBe(0.5)
    expect(overridden.cornerSmoothing).toBe(0.2)
    editor.redoAction()
    await Promise.resolve()
    expect(inherited.cornerSmoothing).toBe(1)
    expect(overridden.cornerSmoothing).toBe(0.2)
  } finally {
    editor.dispose()
  }
})
