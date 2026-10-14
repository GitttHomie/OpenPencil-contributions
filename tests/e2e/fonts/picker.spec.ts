import { readFile } from 'node:fs/promises'

import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { mockFontsource } from '#tests/helpers/fonts/fontsource'
import { mockGoogleFonts } from '#tests/helpers/fonts/google'
import {
  fontOptionCenterOffset,
  fontPreviewLoaded,
  mockFontPickerCatalog
} from '#tests/helpers/fonts/picker'

test.beforeEach(async ({ page }) => {
  await mockFontsource(page, [])
})

async function openTypographyForText(page: Page, fontFamily = 'Inter') {
  await page.goto('/')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()

  return page.evaluate((family) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const id = store.createShape('TEXT', 120, 120, 240, 40)
    store.updateNode(id, { characters: 'Font picker smoke', fontFamily: family })
    store.select([id])
    return id
  }, fontFamily)
}

async function openFontPicker(page: Page) {
  await page.getByTestId('font-picker-trigger').click()
}

async function searchFonts(page: Page, query: string) {
  await page.getByRole('combobox', { name: 'Search fonts…' }).fill(query)
}

test('font picker centers the selected family on first open and after a searched selection', async ({
  page
}) => {
  await mockGoogleFonts(page, [])
  await mockFontPickerCatalog(page)
  await openTypographyForText(page, 'F Sample 2')
  await openFontPicker(page)

  const selected = page.getByRole('option', { name: /^F Sample 2\b/ })
  await expect(selected).toBeVisible()
  await expect.poll(() => fontOptionCenterOffset(selected)).toBeLessThan(3)

  await searchFonts(page, 'G Sample 2')
  await page.getByRole('option', { name: /^G Sample 2\b/ }).click()
  await expect(page.getByTestId('font-picker-trigger')).toContainText('G Sample 2')
  await openFontPicker(page)
  await expect(page.getByRole('combobox', { name: 'Search fonts…' })).toHaveValue('')
  const next = page.getByRole('option', { name: /^G Sample 2\b/ })
  await expect(next).toBeVisible()
  await expect.poll(() => fontOptionCenterOffset(next)).toBeLessThan(3)
  await expect(page.getByRole('option', { name: /^G Sample 1\b/ })).toBeVisible()
  await expect(page.getByRole('option', { name: /^G Sample 3\b/ })).toBeVisible()
  const search = page.getByRole('combobox', { name: 'Search fonts…' })
  await search.press('ArrowDown')
  await search.press('Enter')
  await expect(page.getByTestId('font-picker-trigger')).toContainText('G Sample 3')
})

test('bound fonts remain selectable and a local font edit can update the shared text style', async ({
  page
}, testInfo) => {
  await mockGoogleFonts(page, [])
  await mockFontsource(page, [
    {
      family: 'Replacement Font',
      subset: 'latin',
      data: await readFile('packages/core/assets/Inter-Regular.ttf')
    }
  ])
  const source = await openTypographyForText(page)
  const ids = await page.evaluate((sourceId) => {
    const store = window.openPencil.getStore()
    store.createFontVariable(sourceId, 'fontWeight', 'Display weight')
    const styleId = store.createTextStyle(sourceId, 'Display / Large')
    const follower = store.graph.createNode('TEXT', store.state.currentPageId, { text: 'Follower' })
    store.applyTextStyle(follower.id, styleId)
    const node = store.graph.getNode(sourceId)
    return { source: sourceId, follower: follower.id, family: node?.boundVariables.fontFamily }
  }, source)
  const typography = page.getByTestId('typography')
  await typography.screenshot({ path: testInfo.outputPath('bound-font-controls.png') })
  const state = () =>
    page.evaluate(({ source, follower }) => {
      const store = window.openPencil.getStore()
      return [source, follower].map((id) => {
        const node = store.graph.getNode(id)
        return {
          family: node?.fontFamily,
          binding: node?.boundVariables.fontFamily,
          weight: node?.fontWeight
        }
      })
    }, ids)
  await openFontPicker(page)
  await page.keyboard.press('Escape')
  expect((await state())[0]?.binding).toBe(ids.family)
  await typography.getByRole('combobox', { name: 'Font weight', exact: true }).click()
  await page.getByRole('option', { name: 'Bold', exact: true }).click()
  expect((await state())[0]?.weight).toBe(700)
  await openFontPicker(page)
  await searchFonts(page, 'Replacement Font')
  await page.getByRole('option', { name: /^Replacement Font\b/ }).click()
  expect((await state())[0]?.family).toBe('Replacement Font')
  expect((await state())[0]?.binding).toBeUndefined()
  expect((await state())[1]?.family).toBe('Inter')
  await typography.getByRole('combobox', { name: 'Text style' }).click()
  await page.getByRole('button', { name: 'Update style', exact: true }).click()
  await expect.poll(async () => (await state())[1]?.family).toBe('Replacement Font')
  expect((await state())[1]?.binding).toBeUndefined()
})

test('visible fonts load previews without hovering or selecting, without loading the whole catalog', async ({
  page
}, testInfo) => {
  await mockGoogleFonts(page, [])
  const data = await readFile('packages/core/assets/Inter-Regular.ttf')
  const fonts = await mockFontsource(
    page,
    Array.from({ length: 40 }, (_, index) => ({
      family: `Preview ${String(index).padStart(2, '0')}`,
      subset: 'latin',
      data
    }))
  )
  await openTypographyForText(page)
  expect(fonts.counts.downloads).toBe(0)
  await openFontPicker(page)
  await expect.poll(() => fontPreviewLoaded(page, 'Preview 00')).toBe(true)
  expect(fonts.counts.downloads).toBeLessThan(40)
  await expect(page.getByTestId('font-picker-trigger')).toContainText('Inter')
  await testInfo.attach('visible-font-previews', {
    body: await page.screenshot({ path: testInfo.outputPath('visible-font-previews.png') }),
    contentType: 'image/png'
  })
})

test('font picker selects local fonts without browser web-font access', async ({ page }) => {
  const fonts = await mockGoogleFonts(page)
  await page.addInitScript(() => {
    Object.defineProperty(window, 'queryLocalFonts', {
      configurable: true,
      value: async () => [
        {
          family: 'Inter',
          fullName: 'Inter Regular',
          postscriptName: 'Inter-Regular',
          style: 'Regular'
        },
        {
          family: 'OpenPencil Local Font',
          fullName: 'OpenPencil Local Font Regular',
          postscriptName: 'OpenPencilLocalFont-Regular',
          style: 'Regular'
        }
      ]
    })
  })

  const textId = await openTypographyForText(page)
  await openFontPicker(page)
  await searchFonts(page, 'OpenPencil Local Font')

  await expect(
    page.getByTestId('font-picker-item').filter({ hasText: 'OpenPencil Local Font' })
  ).toBeVisible()
  await page.getByTestId('font-picker-item').filter({ hasText: 'OpenPencil Local Font' }).click()

  await expect(page.getByTestId('font-picker-trigger')).toContainText('OpenPencil Local Font')
  await expect
    .poll(async () =>
      page.evaluate((id) => {
        const store = window.openPencil?.getStore?.()
        const node = store?.graph.getNode(id)
        return node?.type === 'TEXT' ? node.fontFamily : null
      }, textId)
    )
    .toBe('OpenPencil Local Font')
  expect(fonts.counts.metadata).toBe(0)
})

test('font picker keeps bundled fonts when local and web fonts are unavailable', async ({
  page
}) => {
  const fonts = await mockGoogleFonts(page)
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, 'queryLocalFonts')
  })

  await openTypographyForText(page)
  await openFontPicker(page)
  await searchFonts(page, 'Inter')

  await expect(
    page.getByTestId('font-picker-item').filter({ hasText: /^Interbundled$/ })
  ).toBeVisible()
  await expect(
    page.getByTestId('font-picker-item').filter({ hasText: 'OpenPencil Google Font' })
  ).toHaveCount(0)
  expect(fonts.counts.metadata).toBe(0)
})

test('font picker keeps bundled fonts when local font permission is rejected', async ({ page }) => {
  const fonts = await mockGoogleFonts(page)
  await page.addInitScript(() => {
    Object.defineProperty(window, 'queryLocalFonts', {
      configurable: true,
      value: async () => {
        throw new Error('denied')
      }
    })
  })

  await openTypographyForText(page)
  await openFontPicker(page)
  await searchFonts(page, 'Inter')

  await expect(
    page.getByTestId('font-picker-item').filter({ hasText: /^Interbundled$/ })
  ).toBeVisible()
  await expect(
    page.getByTestId('font-picker-item').filter({ hasText: 'OpenPencil Google Font' })
  ).toHaveCount(0)
  expect(fonts.counts.metadata).toBe(0)
})

test('font picker keeps bundled Inter available when local and Google fonts are unavailable', async ({
  page
}) => {
  await mockGoogleFonts(page, [])
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, 'queryLocalFonts')
  })

  await openTypographyForText(page)
  await openFontPicker(page)
  await searchFonts(page, 'Inter')

  await expect(
    page.getByTestId('font-picker-item').filter({ hasText: /^Interbundled$/ })
  ).toBeVisible()
})
