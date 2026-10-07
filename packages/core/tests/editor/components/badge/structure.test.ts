import { expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { createEditor } from '#core/editor'

for (const target of ['badge', 'number'] as const) {
  test(`wrapping the ${target} in auto layout reuses instance descendants through undo and redo`, async () => {
    const editor = createEditor()
    try {
      const button = editor.graph.createNode('COMPONENT', editor.state.currentPageId, {
        name: 'Button',
        layoutMode: 'HORIZONTAL',
        width: 120,
        height: 40
      })
      const badge = editor.graph.createNode('FRAME', button.id, {
        name: 'Badge',
        x: 100,
        y: -8,
        width: 24,
        height: 24,
        layoutPositioning: 'ABSOLUTE'
      })
      const number = editor.graph.createNode('TEXT', badge.id, {
        name: 'Number',
        text: '1',
        width: 8,
        height: 12
      })
      const instance = expectDefined(
        editor.graph.createInstance(button.id, editor.state.currentPageId)
      )
      await Promise.resolve()
      const badgeCopy = expectDefined(editor.graph.getChildren(instance.id)[0])
      const numberCopy = expectDefined(editor.graph.getChildren(badgeCopy.id)[0])
      editor.updateNodeWithUndo(numberCopy.id, { text: '9' })
      editor.select([target === 'badge' ? badge.id : number.id])
      editor.wrapInAutoLayout()
      const wrapperId = expectDefined([...editor.state.selectedIds][0])
      await Promise.resolve()
      const parentCopy = target === 'badge' ? instance : badgeCopy
      const wrappedCopy = target === 'badge' ? badgeCopy : numberCopy
      const assertWrapped = () => {
        expect(parentCopy.childIds).toHaveLength(1)
        const wrapperCopy = expectDefined(editor.graph.getChildren(parentCopy.id)[0])
        expect(wrapperCopy.componentId).toBe(wrapperId)
        expect(wrapperCopy.childIds).toEqual([wrappedCopy.id])
        expect(editor.graph.getNode(numberCopy.id)?.text).toBe('9')
      }
      assertWrapped()
      for (let cycle = 0; cycle < 2; cycle++) {
        editor.undoAction()
        await Promise.resolve()
        expect(parentCopy.childIds).toEqual([wrappedCopy.id])
        expect(editor.graph.getNode(numberCopy.id)?.text).toBe('9')
        editor.redoAction()
        await Promise.resolve()
        assertWrapped()
      }
    } finally {
      editor.dispose()
    }
  })
}

test('moving a blank text into a badge before typing does not leave an empty instance copy', async () => {
  const editor = createEditor()
  try {
    const component = editor.graph.createNode('COMPONENT', editor.state.currentPageId)
    const badge = editor.graph.createNode('FRAME', component.id, { name: 'Badge' })
    const text = editor.graph.createNode('TEXT', component.id, { name: 'Number', text: '' })
    const instance = expectDefined(
      editor.graph.createInstance(component.id, editor.state.currentPageId)
    )
    await Promise.resolve()
    const numberCopy = expectDefined(
      editor.graph.getChildren(instance.id).find((node) => node.componentId === text.id)
    )
    editor.graph.reparentNode(text.id, badge.id)
    editor.updateNodeWithUndo(text.id, { text: '1' })
    editor.setLayoutMode(badge.id, 'HORIZONTAL')
    await Promise.resolve()
    expect(instance.childIds).toHaveLength(1)
    const badgeCopy = expectDefined(editor.graph.getChildren(instance.id)[0])
    expect(badgeCopy.childIds).toEqual([numberCopy.id])
    expect(numberCopy.text).toBe('1')
  } finally {
    editor.dispose()
  }
})

test('moving a layer out of a component updates the old component occurrence', async () => {
  const editor = createEditor()
  try {
    const component = editor.graph.createNode('COMPONENT', editor.state.currentPageId)
    const text = editor.graph.createNode('TEXT', component.id, { text: '1' })
    const instance = expectDefined(
      editor.graph.createInstance(component.id, editor.state.currentPageId)
    )
    await Promise.resolve()
    editor.graph.reparentNode(text.id, editor.state.currentPageId)
    await Promise.resolve()
    expect(instance.childIds).toEqual([])
    expect(editor.graph.getNode(text.id)?.text).toBe('1')
  } finally {
    editor.dispose()
  }
})

test('enabling badge auto layout removes a stale blank duplicate and keeps the edited instance text', async () => {
  const editor = createEditor()
  try {
    const component = editor.graph.createNode('COMPONENT', editor.state.currentPageId)
    const badge = editor.graph.createNode('FRAME', component.id, { name: 'Badge' })
    const number = editor.graph.createNode('TEXT', badge.id, { text: '1', width: 8, height: 12 })
    const instance = expectDefined(
      editor.graph.createInstance(component.id, editor.state.currentPageId)
    )
    await Promise.resolve()
    const badgeCopy = expectDefined(editor.graph.getChildren(instance.id)[0])
    const oldCopy = expectDefined(editor.graph.getChildren(badgeCopy.id)[0])
    editor.graph.updateNode(oldCopy.id, { text: '' })
    const editedCopy = editor.graph.createNode('TEXT', badgeCopy.id, {
      componentId: number.id,
      text: '1',
      width: 8,
      height: 12
    })
    editor.updateNodeWithUndo(editedCopy.id, { text: '9' })
    editor.setLayoutMode(badge.id, 'VERTICAL')
    await Promise.resolve()
    expect(badgeCopy.childIds).toEqual([editedCopy.id])
    expect(editedCopy.text).toBe('9')
  } finally {
    editor.dispose()
  }
})
