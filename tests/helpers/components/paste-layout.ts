import type { Page } from '@playwright/test'

export function seedPasteLayout(page: Page) {
  return page.evaluate(async () => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Editor unavailable')
    const graph = editor.graph
    const component = graph.createNode('COMPONENT', editor.state.currentPageId, {
      name: 'Button',
      x: 60,
      y: 100,
      width: 320,
      layoutMode: 'VERTICAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'FIXED',
      paddingTop: 12,
      paddingBottom: 12,
      fills: [
        { type: 'SOLID', color: { r: 0.85, g: 0.9, b: 0.95, a: 1 }, opacity: 1, visible: true }
      ]
    })
    const content = graph.createNode('FRAME', component.id, {
      name: 'Content',
      width: 320,
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'HUG',
      layoutAlignSelf: 'STRETCH'
    })
    const items = graph.createNode('FRAME', content.id, {
      name: 'Items',
      width: 320,
      layoutMode: 'VERTICAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'FIXED',
      layoutGrow: 1,
      itemSpacing: 4
    })
    for (const height of [24, 16, 22])
      graph.createNode('FRAME', items.id, {
        name: `Item ${height}`,
        width: 320,
        height,
        layoutAlignSelf: 'STRETCH',
        fills: [
          { type: 'SOLID', color: { r: 0.2, g: 0.4, b: 0.8, a: 1 }, opacity: 1, visible: true }
        ]
      })
    editor.runLayoutForNode(component.id)
    graph.createInstance(component.id, editor.state.currentPageId, {
      name: 'Button instance',
      x: 440,
      y: 100
    })
    await Promise.resolve()
    editor.select([items.id])
  })
}

export function pasteIntoSavedLayout(page: Page) {
  return page.evaluate(async () => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Editor unavailable')
    const graph = editor.graph
    const component = [...graph.getAllNodes()].find(
      (node) => node.type === 'COMPONENT' && node.name === 'Button'
    )
    const content = component && graph.getChildren(component.id)[0]
    const items = content && graph.getChildren(content.id)[0]
    const source = items && graph.getChildren(items.id)[0]
    if (!items || !source) throw new Error('Saved layout unavailable')
    editor.select([source.id])
    const payload = await editor.prepareCopy()
    if (!payload.snapshot) throw new Error('Clipboard snapshot unavailable')
    editor.select([items.id])
    await editor.pasteSnapshot(payload.snapshot)
    editor.select([items.id])
    editor.zoomToFit()
  })
}

export function readPasteLayout(page: Page) {
  return page.evaluate(() => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Editor unavailable')
    const graph = editor.graph
    const values = (name: string) =>
      [...graph.getAllNodes()].filter((n) => n.name === name).map((n) => n.height)
    return {
      items: values('Items'),
      content: values('Content'),
      component: values('Button'),
      instance: values('Button instance')
    }
  })
}
