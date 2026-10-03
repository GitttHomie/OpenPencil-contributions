import { expect, test } from 'bun:test'

import { createEditor } from '#core/editor'
import { setTextMeasurer } from '#core/layout'

test('manual text width disables auto-width; font metrics and undo preserve the chosen box', () => {
  const editor = createEditor()
  setTextMeasurer((node, maxWidth) => ({
    width: maxWidth ?? node.fontWeight / 50,
    height: node.fontSize
  }))
  try {
    const text = editor.graph.createNode('TEXT', editor.state.currentPageId, {
      text: '1',
      width: 8,
      height: 14,
      fontSize: 14,
      textAutoResize: 'WIDTH_AND_HEIGHT'
    })
    const preview = editor.beginNodePreview('Type width')
    preview.update(text.id, { width: 32.5 })
    expect(text).toMatchObject({ width: 32.5, textAutoResize: 'HEIGHT' })
    preview.commit()
    editor.updateNodeWithUndo(text.id, { fontWeight: 700, fontSize: 20 })
    expect(text).toMatchObject({ width: 32.5, height: 20, textAutoResize: 'HEIGHT' })
    editor.undoAction()
    expect(text).toMatchObject({ width: 32.5, height: 14, textAutoResize: 'HEIGHT' })
    editor.undoAction()
    expect(text).toMatchObject({ width: 8, height: 14, textAutoResize: 'WIDTH_AND_HEIGHT' })
    editor.redoAction()
    expect(text).toMatchObject({ width: 32.5, textAutoResize: 'HEIGHT' })
    const height = editor.beginNodePreview('Type height')
    height.update(text.id, { height: 24.5 })
    height.commit()
    editor.updateNodeWithUndo(text.id, { fontWeight: 900, fontSize: 30 })
    expect(text).toMatchObject({ width: 32.5, height: 24.5, textAutoResize: 'NONE' })
    editor.undoAction()
    editor.undoAction()
    expect(text).toMatchObject({ width: 32.5, height: 14, textAutoResize: 'HEIGHT' })
  } finally {
    editor.dispose()
    setTextMeasurer(null)
  }
})
