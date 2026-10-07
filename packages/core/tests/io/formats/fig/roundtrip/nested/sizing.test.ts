import { expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { exportFigFile, initCodec, parseFigFile } from '@open-pencil/core'
import { createEditor } from '@open-pencil/core/editor'

test('a reopened nested variant resizes every Hug instance in its parent chain', async () => {
  await initCodec()
  const editor = createEditor()
  let reopened: ReturnType<typeof createEditor> | undefined
  try {
    const graph = editor.graph
    const page = editor.state.currentPageId
    const layout = {
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG'
    } as const
    const icon = graph.createNode('COMPONENT', page, { name: 'Icon', ...layout })
    graph.createNode('FRAME', icon.id, { width: 24, height: 24 })
    const large = expectDefined(editor.addVariant(icon.id))
    graph.updateNode(expectDefined(graph.getChildren(large)[0]).id, { width: 48, height: 48 })
    const set = expectDefined(graph.getNode(icon.parentId ?? ''))
    const variant = expectDefined(
      set.componentPropertyDefinitions.find((item) => item.type === 'VARIANT')
    )
    const largeValue = expectDefined(graph.getNode(large)).componentPropertyValues[variant.name]
    const smallValue = icon.componentPropertyValues[variant.name]
    const button = graph.createNode('COMPONENT', page, { name: 'Button', ...layout })
    const source = expectDefined(graph.createInstance(icon.id, button.id))
    editor.setNestedComponentPropertyExposure(button.id, source.id, [variant.id])
    const card = graph.createNode('COMPONENT', page, { name: 'Card', ...layout })
    const buttonInCard = expectDefined(graph.createInstance(button.id, card.id))
    const buttonControl = expectDefined(
      editor.getInstanceComponentPropertyDefinitions(buttonInCard.id)[0]
    )
    editor.setNestedComponentPropertyExposure(card.id, buttonInCard.id, [buttonControl.id])
    graph.createInstance(card.id, page, { name: 'Card instance' })
    await Promise.resolve()
    const document = await parseFigFile((await exportFigFile(graph)).slice().buffer)
    reopened = createEditor({ graph: document })
    const saved = expectDefined(
      [...document.getAllNodes()].find((node) => node.name === 'Card instance')
    )
    const savedButton = expectDefined(document.getChildren(saved.id)[0])
    const savedIcon = expectDefined(document.getChildren(savedButton.id)[0])
    const control = expectDefined(reopened.getInstanceComponentPropertyDefinitions(saved.id)[0])
    const expectSize = (size: number) => {
      for (const node of [saved, savedButton, savedIcon]) {
        expect(node.width).toBe(size)
        expect(node.height).toBe(size)
      }
    }
    expectSize(24)
    reopened.setInstanceComponentProperty(saved.id, control.id, largeValue)
    await Promise.resolve()
    expectSize(48)
    reopened.undo.undo()
    expectSize(24)
    reopened.undo.redo()
    expectSize(48)
    reopened.setInstanceComponentProperty(saved.id, control.id, smallValue)
    await Promise.resolve()
    expectSize(24)
  } finally {
    reopened?.dispose()
    editor.dispose()
  }
})
