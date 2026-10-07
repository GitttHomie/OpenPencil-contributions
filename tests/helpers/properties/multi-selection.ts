import type { Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

export async function createMultiSelectionScene(page: Page, kind: 'mixed' | 'text' | 'containers') {
  await page.goto('/?test&no-rulers')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await canvas.clearCanvas()
  const ids = await page.evaluate((kind) => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Missing editor')
    const first = editor.graph.createNode(
      kind === 'containers' ? 'FRAME' : 'TEXT',
      editor.state.currentPageId,
      {
        name: 'First',
        text: 'First',
        fontFamily: 'Inter',
        fontSize: 16,
        fontWeight: 400,
        x: 100,
        y: 100,
        width: 100,
        height: 40,
        textAutoResize: 'NONE',
        layoutMode: kind === 'containers' ? 'VERTICAL' : 'NONE',
        itemSpacing: 8,
        paddingLeft: 8
      }
    )
    const containerType = kind === 'containers' ? 'COMPONENT' : 'FRAME'
    const second = editor.graph.createNode(
      kind === 'text' ? 'TEXT' : containerType,
      editor.state.currentPageId,
      {
        name: 'Second',
        text: 'Second',
        fontFamily: 'Roboto',
        fontSize: 24,
        fontWeight: 600,
        textAlignHorizontal: 'RIGHT',
        textAlignVertical: 'BOTTOM',
        textDecoration: 'UNDERLINE',
        x: 280,
        y: 100,
        width: 180,
        height: 40,
        textAutoResize: 'NONE',
        layoutMode: kind === 'containers' ? 'VERTICAL' : 'NONE',
        itemSpacing: 16,
        paddingLeft: 16
      }
    )
    if (kind === 'containers')
      for (const parent of [first, second]) {
        editor.graph.createNode('RECTANGLE', parent.id, { width: 20, height: 20 })
        editor.graph.createNode('RECTANGLE', parent.id, { width: 30, height: 20 })
      }
    editor.select([first.id, second.id])
    editor.requestRender()
    return [first.id, second.id]
  }, kind)
  return {
    canvas,
    ids,
    read: () =>
      page.evaluate((ids) => {
        const editor = window.openPencil?.getStore?.()
        if (!editor) throw new Error('Missing editor')
        return ids.map((id) => {
          const node = editor.graph.getNode(id)
          if (!node) throw new Error('Missing node')
          return {
            width: node.width,
            minWidth: node.minWidth,
            textAlignHorizontal: node.textAlignHorizontal,
            textAlignVertical: node.textAlignVertical,
            textDecoration: node.textDecoration,
            italic: node.italic,
            height: node.height,
            fontFamily: node.fontFamily,
            fontWeight: node.fontWeight,
            fontSize: node.fontSize,
            textAutoResize: node.textAutoResize,
            layoutMode: node.layoutMode,
            itemSpacing: node.itemSpacing,
            paddingLeft: node.paddingLeft,
            primaryAxisSizing: node.primaryAxisSizing
          }
        })
      }, ids)
  }
}
