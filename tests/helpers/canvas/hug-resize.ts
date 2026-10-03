import type { Page } from '@playwright/test'

export async function createHugResizeFixture(page: Page) {
  return page.evaluate(() => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Editor unavailable')
    const root = editor.graph.createNode('FRAME', editor.state.currentPageId, {
      name: 'Outer frame',
      x: 10,
      y: 30,
      width: 100,
      height: 100,
      fills: [
        { type: 'SOLID', color: { r: 0.92, g: 0.94, b: 0.96, a: 1 }, opacity: 1, visible: true }
      ]
    })
    const hug = editor.graph.createNode('FRAME', root.id, {
      name: 'Hug content',
      x: 20,
      y: 20,
      width: 50.5,
      height: 30.5,
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG',
      horizontalConstraint: 'STRETCH',
      verticalConstraint: 'STRETCH'
    })
    editor.graph.createNode('FRAME', hug.id, {
      width: 50.5,
      height: 30.5,
      fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.2, b: 0.4, a: 1 }, opacity: 1, visible: true }]
    })
    const badge = editor.graph.createNode('FRAME', hug.id, {
      name: 'Badge',
      x: 45.5,
      y: -5.5,
      width: 10,
      height: 10,
      layoutPositioning: 'ABSOLUTE',
      horizontalConstraint: 'MAX',
      verticalConstraint: 'MIN',
      fills: [{ type: 'SOLID', color: { r: 1, g: 0.35, b: 0.2, a: 1 }, opacity: 1, visible: true }]
    })
    editor.runLayoutForNode(root.id)
    editor.select([root.id])
    editor.requestRender()
    return { root: root.id, hug: hug.id, badge: badge.id }
  })
}

export async function readHugResizeGeometry(page: Page, ids: string[]) {
  return page.evaluate((ids) => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Editor unavailable')
    return ids.map((id) => {
      const node = editor.graph.getNode(id)
      if (!node) throw new Error('Hug resize fixture unavailable')
      return { x: node.x, y: node.y, width: node.width, height: node.height }
    })
  }, ids)
}
