import type { Page } from '@playwright/test'

export function createHugTextFixture(page: Page) {
  return page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    const frame = store.graph.createNode('FRAME', store.state.currentPageId, {
      x: 100,
      y: 100,
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG',
      paddingLeft: 16,
      paddingRight: 16,
      paddingTop: 16,
      paddingBottom: 16,
      itemSpacing: 12,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]
    })
    const text = store.graph.createNode('TEXT', frame.id, {
      text: 'Hello',
      fontFamily: 'Inter',
      fontSize: 24,
      textAutoResize: 'WIDTH_AND_HEIGHT',
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
    const sibling = store.graph.createNode('RECTANGLE', frame.id, {
      width: 24,
      height: 24,
      fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.4, b: 1, a: 1 }, opacity: 1, visible: true }]
    })
    await store.loadFontsForNodes([text.id])
    store.updateNode(text.id, { text: 'Hello' })
    store.select([text.id])
    store.requestRender()
    return { frameId: frame.id, textId: text.id, siblingId: sibling.id }
  })
}

export function readTextEdit(page: Page) {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    const id = store.state.editingTextId
    const node = id ? store.graph.getNode(id) : null
    const caret = store.textEditor?.getCaretRect()
    const position = node ? store.graph.getAbsolutePosition(node.id) : null
    return {
      id,
      text: node?.text,
      cursor: store.textEditor?.caretIndex,
      caret,
      caretPoint:
        caret && position
          ? {
              x: (position.x + caret.x + 1) * store.state.zoom + store.state.panX,
              y: (position.y + (caret.y0 + caret.y1) / 2) * store.state.zoom + store.state.panY
            }
          : null
    }
  })
}

export function holdTextCaretVisible(page: Page) {
  return page.evaluateHandle(() => {
    const store = window.openPencil?.getStore?.()
    const editor = store?.textEditor
    if (!store || !editor) throw new Error('Text editor unavailable')
    const original = Object.getOwnPropertyDescriptor(editor, 'caretVisible')
    if (!original) throw new Error('Caret visibility unavailable')
    Object.defineProperty(editor, 'caretVisible', {
      configurable: true,
      get: () => true,
      set: () => undefined
    })
    store.requestRepaint()
    return {
      restore: () => {
        Object.defineProperty(editor, 'caretVisible', original)
        store.requestRepaint()
      }
    }
  })
}
