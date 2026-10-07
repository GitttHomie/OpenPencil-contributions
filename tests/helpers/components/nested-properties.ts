import type { Page } from '@playwright/test'

export function seedNestedProperties(page: Page, savedSizeClaims = false) {
  return page.evaluate(async (savedSizeClaims) => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Editor unavailable')
    const graph = editor.graph
    const pageId = editor.state.currentPageId
    const button = graph.createNode('COMPONENT', pageId, {
      name: 'Button',
      width: 120,
      height: 40
    })
    const label = graph.createNode('TEXT', button.id, {
      name: 'Caption',
      text: 'Button',
      width: 100,
      height: 20
    })
    editor.exposeComponentProperty(label.id, 'TEXT', 'Caption')
    editor.exposeComponentProperty(label.id, 'VISIBLE', 'Show caption')
    const alternate = editor.addVariant(button.id)
    if (!alternate) throw new Error('Variant unavailable')
    graph.updateNode(alternate, { width: 180, height: 64 })
    const card = graph.createNode('COMPONENT', pageId, {
      name: 'Card',
      x: 200,
      y: 100,
      width: 200,
      height: 100
    })
    const action = graph.createInstance(button.id, card.id, { name: 'Action' })
    if (!action) throw new Error('Nested instance unavailable')
    editor.exposeComponentProperty(action.id, 'VISIBLE', 'Show action')
    const instance = graph.createInstance(card.id, pageId, {
      name: 'Card instance',
      x: 440,
      y: 100
    })
    await Promise.resolve()
    if (savedSizeClaims && instance) {
      const nested = graph.getChildren(instance.id)[0]
      if (!nested) throw new Error('Nested occurrence unavailable')
      for (const node of [action, nested]) {
        node.instanceOverrides.self.set('width', 120)
        node.instanceOverrides.self.set('height', 40)
      }
      instance.instanceOverrides.descendants.set(
        nested.id,
        new Map<string, unknown>([
          ['sourceComponentId', action.id],
          ['width', 120],
          ['height', 40]
        ])
      )
    }
    editor.select([card.id])
  }, savedSizeClaims)
}

export function selectNestedPropertyInstance(page: Page, nested = false) {
  return page.evaluate((nested) => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Editor unavailable')
    const node = editor.graph
      .getChildren(editor.state.currentPageId)
      .find((node) => node.name === 'Card instance')
    if (!node) throw new Error('Instance unavailable')
    const selected = nested ? editor.graph.getChildren(node.id)[0] : node
    if (!selected) throw new Error('Nested instance unavailable')
    editor.select([selected.id])
  }, nested)
}

export function readNestedPropertyText(page: Page) {
  return page.evaluate(() => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Editor unavailable')
    const instance = editor.getSelectedNodes()[0]
    const nested = instance ? editor.graph.getChildren(instance.id)[0] : undefined
    return nested ? editor.graph.getChildren(nested.id)[0]?.text : undefined
  })
}

export function readNestedPropertyGeometry(page: Page) {
  return page.evaluate(() => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Editor unavailable')
    const instance = editor.getSelectedNodes()[0]
    let nested = instance
    if (instance && instance.name !== 'Action')
      nested = editor.graph.getChildren(instance.id).find((node) => node.name === 'Action')
    return nested ? { width: nested.width, height: nested.height } : undefined
  })
}
