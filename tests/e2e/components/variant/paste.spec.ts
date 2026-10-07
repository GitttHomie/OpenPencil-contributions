import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import {
  seedVariantPropertyScene,
  readVariantPropertyScene
} from '#tests/helpers/components/variant-properties'
import { propertySection } from '#tests/helpers/properties'

test('pasting a copied variant into its set adds a definition and displays its first descriptor', async ({
  page
}) => {
  await page.goto('/?test&no-rulers')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await seedVariantPropertyScene(page, 2, false)
  const initial = await readVariantPropertyScene(page)
  if (!initial.set || !initial.variants[1]) throw new Error('Missing set')
  const ids = { set: initial.set.id, source: initial.variants[1].id }
  const html = await page.evaluate(async ({ set, source }) => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Missing editor')
    editor.select([source])
    const payload = await editor.prepareCopy()
    editor.select([set])
    return payload.html
  }, ids)
  await page.evaluate((html) => {
    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', html)
    window.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true })
    )
  }, html)
  await expect.poll(async () => (await readVariantPropertyScene(page)).variants.length).toBe(3)
  await expect(
    propertySection(page, 'Variants').getByRole('combobox', { name: 'Variant', exact: true })
  ).toContainText('Default')
  await expect
    .poll(async () => (await readVariantPropertyScene(page)).variants[2]?.name)
    .toBe('Variant=Default')
  await canvas.pressKey('Meta+z')
  await expect.poll(async () => (await readVariantPropertyScene(page)).variants.length).toBe(2)
  await canvas.pressKey('Meta+Shift+z')
  await expect.poll(async () => (await readVariantPropertyScene(page)).variants.length).toBe(3)
  canvas.assertNoErrors()
})
