import type { Page } from '@playwright/test'

export async function createComponentLabelScene(page: Page) {
  return page.evaluate(() => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Editor unavailable')
    const component = editor.graph.createNode('COMPONENT', editor.state.currentPageId, {
      name: 'Button definition',
      x: 80,
      y: 100,
      width: 220,
      height: 160,
      cornerRadius: 60,
      cornerSmoothing: 1,
      fills: [
        { type: 'SOLID', color: { r: 0.55, g: 0.3, b: 0.9, a: 1 }, visible: true, opacity: 1 }
      ]
    })
    const instance = editor.graph.createInstance(component.id, editor.state.currentPageId, {
      name: 'Button instance',
      x: 360,
      y: 100
    })
    if (!instance) throw new Error('Instance unavailable')
    const frame = editor.graph.createNode('FRAME', editor.state.currentPageId, {
      name: 'Frame title',
      x: 80,
      y: 340,
      width: 220,
      height: 160,
      fills: [{ type: 'SOLID', color: { r: 0.85, g: 0.9, b: 1, a: 1 }, visible: true, opacity: 1 }]
    })
    editor.select([frame.id])
    editor.requestRender()
    return { component: component.id, instance: instance.id, frame: frame.id }
  })
}

export async function readLayerName(page: Page, id: string) {
  return page.evaluate((nodeId) => window.openPencil?.getStore?.().graph.getNode(nodeId)?.name, id)
}

export async function selectComponent(page: Page, id: string) {
  await page.evaluate((nodeId) => window.openPencil?.getStore?.().select([nodeId]), id)
}

export async function readComponentPasteState(page: Page, componentId: string) {
  return page.evaluate((id) => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Editor unavailable')
    const selected = editor.graph.getNode([...editor.state.selectedIds][0])
    return {
      selected: selected && {
        type: selected.type,
        componentId: selected.componentId,
        parentId: selected.parentId
      },
      originalChildren: editor.graph.getNode(id)?.childIds,
      definitionCount: [...editor.graph.nodes.values()].filter((node) => node.type === 'COMPONENT')
        .length,
      pageId: editor.state.currentPageId
    }
  }, componentId)
}

export async function clipboardHTML(page: Page) {
  return page.evaluate(async () => {
    for (const item of await navigator.clipboard.read()) {
      if (item.types.includes('text/html')) return (await item.getType('text/html')).text()
    }
    return ''
  })
}

export async function deliverClipboardPaste(page: Page, html: string) {
  await page.evaluate((content) => {
    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', content)
    window.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true })
    )
  }, html)
}
