import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import {
  pasteIntoSavedLayout,
  readPasteLayout,
  seedPasteLayout
} from '#tests/helpers/components/paste-layout'
import { saveAndReopenPropertyDocument } from '#tests/helpers/components/property-authoring'

test.use({ viewport: { width: 1000, height: 500 } })

test('pasted content grows saved component frames, selection bounds and instances together', async ({
  page
}, testInfo) => {
  await page.goto('/?test&no-chrome&no-rulers')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await seedPasteLayout(page)
  await page.getByTestId('canvas-element').focus()
  await saveAndReopenPropertyDocument(page, testInfo.outputPath('component-paste.fig'))
  await pasteIntoSavedLayout(page)
  const grown = { items: [98, 98], content: [98, 98], component: [122], instance: [122] }
  await expect.poll(() => readPasteLayout(page)).toEqual(grown)
  await canvas.waitForRender()
  expect(await canvas.screenshotCanvasRegion(1000, 500)).toMatchSnapshot(
    'pasted-component-bounds.png'
  )
  await page.getByTestId('canvas-element').focus()
  await page.keyboard.press('Meta+z')
  await expect
    .poll(() => readPasteLayout(page))
    .toEqual({ items: [70, 70], content: [70, 70], component: [94], instance: [94] })
  await page.keyboard.press('Meta+Shift+z')
  await expect.poll(() => readPasteLayout(page)).toEqual(grown)
  canvas.assertNoErrors()
})
