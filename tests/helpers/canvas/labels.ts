import type { Page } from '@playwright/test'

export async function createLabelDragScene(
  page: Page,
  type: 'FRAME' | 'COMPONENT' | 'INSTANCE',
  locked = false
) {
  return page.evaluate(
    ({ type, locked }) => {
      const editor = window.openPencil?.getStore?.()
      if (!editor) throw new Error('Editor unavailable')
      editor.state.snappingPreferences = { geometry: false, objects: false, pixelGrid: false }
      const props = {
        name: 'A long draggable container name',
        x: 120,
        y: 160,
        width: 120,
        height: 100,
        locked,
        fills: [
          {
            type: 'SOLID' as const,
            color: { r: 0.4, g: 0.6, b: 0.9, a: 1 },
            visible: true,
            opacity: 1
          }
        ]
      }
      let node
      if (type === 'INSTANCE') {
        const component = editor.graph.createNode('COMPONENT', editor.state.currentPageId, {
          ...props,
          x: 1500
        })
        editor.graph.createNode('RECTANGLE', component.id, { x: 12, y: 18, width: 30, height: 20 })
        node = editor.graph.createInstance(component.id, editor.state.currentPageId, props)
      } else {
        node = editor.graph.createNode(type, editor.state.currentPageId, props)
        editor.graph.createNode('RECTANGLE', node.id, { x: 12, y: 18, width: 30, height: 20 })
      }
      if (!node) throw new Error('Container unavailable')
      editor.select([node.id])
      editor.requestRender()
      return node.id
    },
    { type, locked }
  )
}

export async function readLabelDragGeometry(page: Page, id: string) {
  return page.evaluate((nodeId) => {
    const editor = window.openPencil?.getStore?.()
    const node = editor?.graph.getNode(nodeId)
    if (!editor || !node) throw new Error('Container unavailable')
    return {
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      rotation: node.rotation,
      children: editor.graph.getChildren(node.id).map((child) => ({
        x: child.x,
        y: child.y,
        world: editor.graph.getAbsolutePosition(child.id)
      }))
    }
  }, id)
}
