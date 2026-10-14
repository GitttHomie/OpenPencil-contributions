import type { Page } from '@playwright/test'

/** An agent or collaborator can remove a selection while its inspector field is focused. */
export async function removeInspectedSelection(page: Page) {
  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.deleteSelected()
  })
}

export function activeTool(page: Page) {
  return page.evaluate(() => window.openPencil?.getStore?.().state.activeTool)
}
