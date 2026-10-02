import type { Page } from '@playwright/test'

import { CanvasHelper } from './canvas'

export async function createLayoutModeScene(page: Page) {
  await page.goto('/?test&no-rulers')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  const ids = await page.evaluate(() => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Editor unavailable')
    editor.state.panX = 0
    editor.state.panY = 0
    editor.state.zoom = 1
    const outer = editor.graph.createNode('FRAME', editor.state.currentPageId, {
      name: 'Outer Hug row',
      x: 60,
      y: 100,
      width: 500,
      height: 300,
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG',
      itemSpacing: 24,
      paddingTop: 20,
      paddingRight: 20,
      paddingBottom: 20,
      paddingLeft: 20
    })
    const frame = editor.graph.createNode('FRAME', outer.id, {
      name: 'Free layout',
      width: 260,
      height: 180
    })
    const first = editor.graph.createNode('RECTANGLE', frame.id, {
      name: 'First',
      x: 20,
      y: 35,
      width: 90,
      height: 40
    })
    const second = editor.graph.createNode('FRAME', frame.id, {
      name: 'Nested row',
      x: 145,
      y: 95,
      width: 80,
      height: 55,
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED',
      layoutAlignSelf: 'STRETCH',
      paddingLeft: 10,
      paddingTop: 10,
      paddingRight: 10,
      paddingBottom: 10
    })
    editor.graph.createNode('RECTANGLE', second.id, {
      width: 60,
      height: 20,
      primaryAxisSizing: 'FILL',
      layoutGrow: 1
    })
    editor.graph.createNode('RECTANGLE', outer.id, { name: 'Sibling', width: 100, height: 70 })
    editor.runLayoutForNode(outer.id)
    editor.select([frame.id])
    editor.requestRender()
    return { outer: outer.id, frame: frame.id, first: first.id, second: second.id }
  })
  await canvas.waitForRender()
  return {
    canvas,
    ids,
    async select(nodeIds: string[]) {
      await page.evaluate((ids) => window.openPencil?.getStore?.().select(ids), nodeIds)
      await page.getByTestId('canvas-element').focus()
    },
    async setLayoutMode(id: string, mode: 'NONE' | 'HORIZONTAL' | 'VERTICAL' | 'GRID') {
      await page.evaluate(
        ({ id, mode }) => window.openPencil?.getStore?.().setLayoutMode(id, mode),
        { id, mode }
      )
    },
    async read() {
      return page.evaluate(() => {
        const editor = window.openPencil?.getStore?.()
        if (!editor) throw new Error('Editor unavailable')
        return {
          nodes: [...editor.graph.nodes.values()].map((node) => ({
            id: node.id,
            parentId: node.parentId,
            childIds: [...node.childIds],
            x: node.x,
            y: node.y,
            width: node.width,
            height: node.height,
            layoutMode: node.layoutMode,
            layoutPositioning: node.layoutPositioning,
            layoutGrow: node.layoutGrow,
            layoutAlignSelf: node.layoutAlignSelf,
            primaryAxisSizing: node.primaryAxisSizing,
            counterAxisSizing: node.counterAxisSizing,
            itemSpacing: node.itemSpacing,
            paddingTop: node.paddingTop,
            paddingRight: node.paddingRight,
            paddingBottom: node.paddingBottom,
            paddingLeft: node.paddingLeft
          })),
          selected: [...editor.state.selectedIds],
          canUndo: editor.undo.canUndo
        }
      })
    }
  }
}
