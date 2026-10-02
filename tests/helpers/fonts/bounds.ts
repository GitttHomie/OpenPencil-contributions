import type { Page } from '@playwright/test'

export async function createTextBoundsFixture(page: Page) {
  return page.evaluate(() => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Editor unavailable')
    const frame = editor.graph.createNode('FRAME', editor.state.currentPageId, {
      name: 'Button',
      x: 80,
      y: 100,
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG',
      paddingLeft: 16,
      paddingRight: 16,
      paddingTop: 12,
      paddingBottom: 12
    })
    const text = editor.graph.createNode('TEXT', frame.id, {
      name: 'Label',
      text: 'button',
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 24,
      textAutoResize: 'WIDTH_AND_HEIGHT',
      layoutSizingHorizontal: 'HUG',
      layoutSizingVertical: 'HUG'
    })
    const standalone = editor.graph.createNode('TEXT', editor.state.currentPageId, {
      name: 'Standalone label',
      text: 'button',
      x: 80,
      y: 200,
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 24,
      textAutoResize: 'WIDTH_AND_HEIGHT'
    })
    for (const node of [text, standalone]) {
      editor.updateNodeWithUndo(node.id, { fontWeight: 500 }, 'Change font weight')
    }
    editor.select([standalone.id])
    editor.requestRender()
    return { frame: frame.id, text: text.id, standalone: standalone.id }
  })
}

export async function readTextBounds(page: Page, id: string) {
  return page.evaluate((nodeId) => {
    const editor = window.openPencil?.getStore?.()
    const node = editor?.graph.getNode(nodeId)
    if (!editor?.renderer || !node) throw new Error('Text unavailable')
    const measured = editor.renderer.measureTextNode(node)
    return {
      width: node.width,
      height: node.height,
      measured,
      selection: editor.textEditor?.nodeId === node.id ? editor.textEditor.getSelectionRects() : []
    }
  }, id)
}
