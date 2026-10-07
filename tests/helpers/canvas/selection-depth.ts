import type { Page } from '@playwright/test'

export async function seedSelectionDepth(
  page: Page,
  type: 'FRAME' | 'GROUP' | 'COMPONENT' | 'INSTANCE' = 'FRAME',
  offsetX = 0
) {
  return page.evaluate(
    ({ type, offsetX }) => {
      const editor = window.openPencil?.getStore?.()
      if (!editor) throw new Error('Editor unavailable')
      editor.state.zoom = 1
      editor.state.panX = 0
      editor.state.panY = 0
      editor.state.enteredContainerId = null
      const parent = editor.graph.createNode(
        type === 'INSTANCE' ? 'COMPONENT' : type,
        editor.state.currentPageId,
        {
          name: 'Button',
          x: 100 + offsetX,
          y: 180,
          width: 180,
          height: 90,
          clipsContent: false,
          fills: [
            { type: 'SOLID', color: { r: 0.1, g: 0.3, b: 0.5, a: 1 }, opacity: 1, visible: true }
          ]
        }
      )
      const badge = editor.graph.createNode('FRAME', parent.id, {
        name: 'Badge',
        x: 150,
        y: -70,
        width: 100,
        height: 90,
        layoutPositioning: 'ABSOLUTE',
        clipsContent: false,
        fills: [{ type: 'SOLID', color: { r: 1, g: 0.5, b: 0.2, a: 1 }, opacity: 1, visible: true }]
      })
      const wrapper = editor.graph.createNode('FRAME', badge.id, {
        name: 'Label wrapper',
        x: 10,
        y: 10,
        width: 80,
        height: 50
      })
      editor.graph.createNode('TEXT', wrapper.id, {
        name: 'Badge label',
        text: 'Badge',
        x: 10,
        y: 5,
        width: 65,
        height: 30,
        fontSize: 18
      })
      let root = parent
      if (type === 'INSTANCE') {
        const instance = editor.graph.createInstance(parent.id, editor.state.currentPageId, {
          x: 100 + offsetX,
          y: 180
        })
        if (!instance) throw new Error('Instance unavailable')
        editor.graph.updateNode(parent.id, { x: -1000 })
        root = instance
      }
      const instanceBadge = editor.graph.getChildren(root.id)[0]
      const instanceWrapper = editor.graph.getChildren(instanceBadge.id)[0]
      const label = editor.graph.getChildren(instanceWrapper.id)[0]
      editor.select([])
      editor.requestRender()
      return {
        parent: root.id,
        badge: instanceBadge.id,
        wrapper: instanceWrapper.id,
        text: label.id
      }
    },
    { type, offsetX }
  )
}

export function selectionDepthState(page: Page) {
  return page.evaluate(() => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Editor unavailable')
    return {
      selected: [...editor.state.selectedIds],
      entered: editor.state.enteredContainerId,
      editing: editor.state.editingTextId
    }
  })
}

export async function clipSelectionParent(page: Page, parentId: string) {
  await page.evaluate((id) => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Editor unavailable')
    editor.graph.updateNode(id, { clipsContent: true })
    editor.state.enteredContainerId = null
    editor.select([])
    editor.requestRender()
  }, parentId)
}

export function selectionNodePosition(page: Page, id: string) {
  return page.evaluate((id) => {
    const node = window.openPencil?.getStore?.().graph.getNode(id)
    return node ? { x: node.x, y: node.y } : null
  }, id)
}

export async function moveSelectionSubtreeToPage(page: Page, id: string) {
  await page.evaluate((id) => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Editor unavailable')
    editor.graph.reparentNode(id, editor.state.currentPageId)
    editor.requestRender()
  }, id)
}
