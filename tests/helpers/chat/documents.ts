import type { Page } from '@playwright/test'

import type * as AppTabs from '@/app/tabs'

/** Document navigation through the same tab actions as the shell. */
export async function chatDocumentId(page: Page) {
  return page.evaluate(async () => {
    const path = '/src/app/tabs/index.ts'
    const tabs: typeof AppTabs = await import(path)
    return tabs.getActiveTabId()
  })
}

export async function openChatDocument(page: Page) {
  return page.evaluate(async () => {
    const path = '/src/app/tabs/index.ts'
    const tabs: typeof AppTabs = await import(path)
    return tabs.createTab().id
  })
}

export async function switchChatDocument(page: Page, id: string) {
  await page.evaluate(async (id) => {
    const path = '/src/app/tabs/index.ts'
    const tabs: typeof AppTabs = await import(path)
    tabs.switchTab(id)
  }, id)
}

export async function closeChatDocument(page: Page, id: string) {
  await page.evaluate(async (id) => {
    const path = '/src/app/tabs/index.ts'
    const tabs: typeof AppTabs = await import(path)
    await tabs.closeTab(id, 'discard')
  }, id)
}
