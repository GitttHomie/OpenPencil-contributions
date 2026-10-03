import type { Page } from '@playwright/test'

import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'
import { CanvasHelper } from '#tests/helpers/canvas'

const editor = useEditorSetup()

async function enableAutosave(page: Page) {
  await page.getByRole('menuitem', { name: 'File', exact: true }).click()
  await page.getByRole('menuitemcheckbox', { name: 'Auto-save to local file' }).click()
  await page.keyboard.press('Escape')
}

test('autosave writes subsequent scene changes to the saved file', async () => {
  const file = await editor.page.evaluateHandle(async () => {
    const directory = await navigator.storage.getDirectory()
    const handle = await directory.getFileHandle('autosave-test.fig', { create: true })
    const original = window.showSaveFilePicker
    window.showSaveFilePicker = async () => handle
    return {
      metadata: async () => {
        const saved = await handle.getFile()
        return { size: saved.size, modified: saved.lastModified }
      },
      restore: async () => {
        window.showSaveFilePicker = original
        await directory.removeEntry(handle.name)
      }
    }
  })
  try {
    await enableAutosave(editor.page)
    await editor.page.keyboard.press('ControlOrMeta+Shift+KeyS')
    await expect
      .poll(() => file.evaluate(async (probe) => (await probe.metadata()).size))
      .toBeGreaterThan(0)
    const saved = await file.evaluate((probe) => probe.metadata())

    await editor.canvas.drawRect(400, 400, 60, 60)
    await expect
      .poll(() => file.evaluate(async (probe) => (await probe.metadata()).modified))
      .toBeGreaterThan(saved.modified)
    await expect(editor.page.getByRole('img', { name: 'Unsaved changes' })).toBeHidden()
    editor.canvas.assertNoErrors()
  } finally {
    await file.evaluate((probe) => probe.restore())
    await file.dispose()
  }
})

test('no autosave without file handle', async ({ browser, baseURL }) => {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2
  })
  const freshPage = await context.newPage()
  await freshPage.goto('/')
  const freshCanvas = new CanvasHelper(freshPage)
  await freshCanvas.waitForInit()
  await enableAutosave(freshPage)

  await freshPage.evaluate(() => {
    Reflect.deleteProperty(window, 'showSaveFilePicker')
  })

  await freshCanvas.drawRect(100, 100, 50, 50)
  await freshPage.waitForTimeout(4000)

  freshCanvas.assertNoErrors()

  await freshPage.close()
  await context.close()
})
