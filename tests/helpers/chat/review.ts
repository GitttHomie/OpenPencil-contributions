import type { Page } from '@playwright/test'

export async function createReviewSelection(page: Page) {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    const frame = store.graph.createNode('FRAME', store.state.currentPageId, {
      name: 'Checkout',
      width: 320,
      height: 240
    })
    store.select([frame.id])
    store.requestRender()
    return frame.id
  })
}
