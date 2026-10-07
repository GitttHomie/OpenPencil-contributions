import type { Page } from '@playwright/test'

export async function seedInternalComponents(page: Page) {
  return page.evaluate(() => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Missing editor')
    const visiblePage = editor.state.currentPageId
    const internal = editor.graph.createNode('CANVAS', editor.graph.rootId, {
      name: 'Imported library components',
      internalOnly: true,
      visible: false,
      locked: true
    })
    const component = editor.graph.createNode('COMPONENT', internal.id, {
      name: 'Library button',
      width: 120,
      height: 40
    })
    const instance = editor.graph.createInstance(component.id, visiblePage, { x: 100, y: 100 })
    if (!instance) throw new Error('Missing instance')
    editor.select([instance.id])
    editor.requestRender()
    return { visiblePage, internal: internal.id, component: component.id }
  })
}

export function internalPageState(page: Page) {
  return page.evaluate(() => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Missing editor')
    return {
      page: editor.state.currentPageId,
      selected: [...editor.state.selectedIds],
      internal: editor.graph
        .getPages(true)
        .filter((page) => page.internalOnly)
        .map((page) => page.id),
      regular: editor.graph.getPages().map((page) => page.id)
    }
  })
}
