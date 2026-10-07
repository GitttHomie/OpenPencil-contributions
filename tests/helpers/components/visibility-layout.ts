import type { Page } from '@playwright/test'

export function seedVisibilityLayout(page: Page) {
  return page.evaluate(async () => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Editor unavailable')
    const graph = editor.graph
    const component = graph.createNode('COMPONENT', editor.state.currentPageId, {
      name: 'Button',
      width: 300,
      height: 60,
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED',
      itemSpacing: 10
    })
    const fixed = graph.createNode('FRAME', component.id, {
      name: 'Fixed',
      width: 80,
      height: 60
    })
    const fill = graph.createNode('FRAME', component.id, {
      name: 'Content',
      width: 210,
      height: 60,
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED',
      layoutGrow: 1
    })
    graph.createNode('FRAME', fill.id, {
      name: 'Inner',
      width: 210,
      height: 60,
      layoutGrow: 1
    })
    editor.exposeComponentProperty(fixed.id, 'VISIBLE', 'Show fixed')
    editor.runLayoutForNode(component.id)
    const instance = graph.createInstance(component.id, editor.state.currentPageId, {
      name: 'Button instance',
      y: 100
    })
    if (!instance) throw new Error('Instance unavailable')
    await Promise.resolve()
    editor.select([instance.id])
  })
}

export function readVisibilityLayout(page: Page, select = false) {
  return page.evaluate((select) => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Editor unavailable')
    const graph = editor.graph
    const instance = graph
      .getChildren(editor.state.currentPageId)
      .find((node) => node.name === 'Button instance')
    if (!instance) throw new Error('Instance unavailable')
    if (select) editor.select([instance.id])
    const children = graph.getChildren(instance.id)
    const fixed = children.find((node) => node.name === 'Fixed')
    const fill = children.find((node) => node.name === 'Content')
    const inner = fill ? graph.getChildren(fill.id)[0] : undefined
    if (!fixed || !fill || !inner) throw new Error('Children unavailable')
    return { visible: fixed.visible, x: fill.x, width: fill.width, innerWidth: inner.width }
  }, select)
}
