import type { Page } from '@playwright/test'

import { CanvasHelper } from './canvas'

export async function createRestoredLayoutScene(page: Page) {
  await page.goto('/?test&no-rulers')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  const ids = await page.evaluate(() => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Editor unavailable')
    editor.state.panX = 0
    editor.state.panY = 0
    editor.state.zoom = 1
    const parent = editor.graph.createNode('FRAME', editor.state.currentPageId, {
      name: 'Restored parent',
      x: 80,
      y: 90,
      width: 480,
      height: 360,
      fills: [{ type: 'SOLID', color: { r: 0.85, g: 0.9, b: 1, a: 1 }, opacity: 1, visible: true }]
    })
    const child = editor.graph.createNode('FRAME', parent.id, {
      name: 'Restored child',
      x: 220,
      y: 150,
      width: 140,
      height: 90,
      horizontalConstraint: 'STRETCH',
      verticalConstraint: 'STRETCH',
      fills: [
        { type: 'SOLID', color: { r: 0.25, g: 0.45, b: 0.8, a: 1 }, opacity: 1, visible: true }
      ]
    })
    // Match the imported metadata retained when a saved document is reopened.
    for (const node of [parent, child]) {
      editor.graph.applyImportedStateDuring(() =>
        editor.graph.updateNode(node.id, {
          source: { ...node.source, format: 'fig', id: node.id },
          derivedLayout: { x: node.x, y: node.y, width: node.width, height: node.height }
        })
      )
    }
    editor.select([parent.id])
    editor.requestRender()
    return { parent: parent.id, child: child.id }
  })
  return {
    ids,
    canvas,
    async select(id: string) {
      await page.evaluate((id) => window.openPencil?.getStore?.().select([id]), id)
      await page.getByTestId('canvas-element').focus()
    },
    async read() {
      return page.evaluate((ids) => {
        const editor = window.openPencil?.getStore?.()
        if (!editor) throw new Error('Editor unavailable')
        return [ids.parent, ids.child].map((id) => {
          const n = editor.graph.getNode(id)
          if (!n) throw new Error('Node unavailable')
          return {
            x: n.x,
            y: n.y,
            width: n.width,
            height: n.height,
            primaryAxisSizing: n.primaryAxisSizing,
            counterAxisSizing: n.counterAxisSizing,
            layoutMode: n.layoutMode,
            layoutGrow: n.layoutGrow,
            layoutAlignSelf: n.layoutAlignSelf,
            horizontalConstraint: n.horizontalConstraint,
            verticalConstraint: n.verticalConstraint
          }
        })
      }, ids)
    }
  }
}

export async function addIndependentSizingLayer(
  page: Page,
  ids: { parent: string; child: string }
) {
  return page.evaluate((ids) => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Editor unavailable')
    const sibling = editor.graph.createNode('FRAME', ids.parent, {
      name: 'Independent content',
      width: 200,
      height: 40,
      fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.6, b: 0.5, a: 1 }, opacity: 1, visible: true }]
    })
    editor.updateNode(ids.child, {
      layoutMode: 'VERTICAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED'
    })
    editor.setLayoutMode(ids.parent, 'VERTICAL')
    editor.updateNode(ids.parent, {
      paddingTop: 16,
      paddingBottom: 16,
      paddingLeft: 16,
      paddingRight: 16,
      itemSpacing: 12
    })
    editor.select([ids.child])
    return sibling.id
  }, ids)
}
