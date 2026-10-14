import { readFile } from 'node:fs/promises'

import { expect, test, type Page } from '@playwright/test'

import { parseFigBuffer } from '@open-pencil/fig'

import type * as AppTabs from '@/app/tabs'

import { CanvasHelper } from '#tests/helpers/canvas'
import { cleanupFixture } from '#tests/helpers/document/cleanup'

async function startOpen(page: Page, orphan = true, internal = true) {
  const bytes = await cleanupFixture(orphan, internal)
  await page.route('**/__cleanup.fig', (route) => route.fulfill({ body: Buffer.from(bytes) }))
  await page.goto('/?test')
  await new CanvasHelper(page).waitForInit()
  return {
    opening: page.evaluate(async () => {
      const url = '/src/app/tabs/index.ts'
      const tabs: typeof AppTabs = await import(url)
      const response = await fetch('/__cleanup.fig')
      await tabs.openFileInNewTab(new File([await response.arrayBuffer()], 'cleanup.fig'))
    })
  }
}

async function saveOpenedDocument(page: Page) {
  await page.evaluate(() => {
    window.showSaveFilePicker = undefined
  })
  page.once('dialog', (dialog) => dialog.accept('cleanup.fig'))
  const download = page.waitForEvent('download')
  await page.keyboard.press('ControlOrMeta+Shift+KeyS')
  const path = await (await download).path()
  if (!path) throw new Error('Download unavailable')
  const bytes = new Uint8Array(await readFile(path))
  return parseFigBuffer(bytes.buffer).nodeChanges.map((node) => node.name)
}

test('accepted cleanup only removes unused internal definitions and persists through save', async ({
  page
}, testInfo) => {
  const { opening } = await startOpen(page)
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toBeVisible()
  await dialog.screenshot({ path: testInfo.outputPath('cleanup-prompt.png') })
  await dialog.getByRole('button', { name: 'Remove unused components' }).click()
  await opening
  const tab = page.locator('[data-slot="tab-item"]').filter({ hasText: 'cleanup' })
  await expect(tab.getByRole('img', { name: 'Unsaved changes' })).toBeVisible()
  const names = await saveOpenedDocument(page)
  expect(names).toContain('Presentation component')
  expect(names).toContain('Used embedded component')
  expect(names).toContain('Used instance')
  expect(names).not.toContain('Unused embedded component')
  expect(names).not.toContain('Orphan content')
})

test('keeping everything preserves unused definitions and leaves the opened document saved', async ({
  page
}) => {
  const { opening } = await startOpen(page)
  await page.getByRole('alertdialog').getByRole('button', { name: 'Keep everything' }).click()
  await opening
  const tab = page.locator('[data-slot="tab-item"]').filter({ hasText: 'cleanup' })
  await expect(tab.getByRole('img', { name: 'Unsaved changes' })).toHaveCount(0)
  expect(await saveOpenedDocument(page)).toContain('Unused embedded component')
})

test('required internal components offer only the explicit destructive choice', async ({
  page
}) => {
  const { opening } = await startOpen(page, false)
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Remove unused components' })).toHaveCount(0)
  await expect(
    dialog.getByRole('button', { name: 'Remove canvases and linked instances' })
  ).toBeVisible()
  await dialog.getByRole('button', { name: 'Keep everything' }).click()
  await opening
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
  const tab = page.locator('[data-slot="tab-item"]').filter({ hasText: 'cleanup' })
  await expect(tab.getByRole('img', { name: 'Unsaved changes' })).toHaveCount(0)
})

test('removing internal canvases preserves a valid button and removes only its nested icon', async ({
  page
}) => {
  const { opening } = await startOpen(page)
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Remove canvases and linked instances' })
    .click()
  await opening
  const names = await saveOpenedDocument(page)
  expect(names).toContain('Valid button')
  expect(names).toContain('Button instance')
  expect(names).toContain('Button label')
  expect(names).toContain('Presentation component')
  expect(names).not.toContain('Nested icon')
  expect(names).not.toContain('Used instance')
  expect(names).not.toContain('Used embedded component')
  expect(names).not.toContain('Internal Only Canvas')
})

test('a document with only authored pages opens without a cleanup prompt', async ({ page }) => {
  const { opening } = await startOpen(page, true, false)
  await opening
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
})

test('a failed accepted cleanup closes the prompt and reports an import failure', async ({
  page
}) => {
  await page.route('**/io/formats/fig/cleanup/worker.ts*', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: `
        self.onmessage = ({ data }) => {
          self.postMessage(data.type === 'analyze'
            ? { type: 'summary', summary: {
                unused: { componentCount: 1, nodeCount: 2 },
                internal: { canvasCount: 1, componentCount: 1, instanceCount: 0, hiddenInstanceCount: 0, pageCount: 0, nodeCount: 3 }
              } }
            : { type: 'error', message: 'Cleanup fixture failure' });
        };
      `
    })
  )
  const { opening } = await startOpen(page)
  const outcome = opening.then(
    () => 'opened',
    () => 'failed'
  )
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Remove unused components' })
    .click()
  expect(await outcome).toBe('failed')
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
})
