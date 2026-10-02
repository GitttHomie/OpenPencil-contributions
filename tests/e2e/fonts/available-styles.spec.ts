import { readFile } from 'node:fs/promises'

import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { mockGoogleFonts } from '#tests/helpers/fonts/google'
import { trackFontModuleResources } from '#tests/helpers/fonts/runtime'
import {
  createTypographyFixture,
  readTypography,
  selectTextForTypography
} from '#tests/helpers/fonts/typography'
import { publicPath } from '#tests/helpers/paths'
import { trackResizeErrors } from '#tests/helpers/resize-errors'
import { getNodeById } from '#tests/helpers/store'

test('Abril Fatface exposes only Regular and prevents unavailable formatting', async ({ page }) => {
  const fonts = await mockGoogleFonts(page, ['Abril Fatface'], {
    weights: [400],
    fontData: await readFile(publicPath('Inter-Regular.ttf'))
  })
  await trackFontModuleResources(page)
  await page.goto('/?test&no-rulers')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  const id = await createTypographyFixture(page, { google: true })
  await page.getByRole('button', { name: 'Font family', exact: true }).click()
  await page.getByRole('combobox', { name: 'Search fonts…' }).fill('Abril')
  await page.getByTestId('font-picker-item').filter({ hasText: 'Abril Fatface' }).click()
  await expect
    .poll(() => readTypography(page, id))
    .toMatchObject({
      fontFamily: 'Abril Fatface',
      fontWeight: 400,
      fontSource: 'google'
    })
  const typography = page.getByRole('region', { name: 'Typography' })
  await expect(typography.getByRole('combobox', { name: 'Font weight' })).toHaveText('Regular')
  await expect(typography.getByRole('combobox', { name: 'Font weight' })).toBeDisabled()
  await expect(typography.getByRole('button', { name: /^Bold \(/ })).toBeDisabled()
  await expect(typography.getByRole('button', { name: /^Italic \(/ })).toBeDisabled()
  await selectTextForTypography(page, id)
  await page.keyboard.press('Meta+b')
  await page.keyboard.press('Meta+i')
  expect((await getNodeById(page, id))?.styleRuns).toEqual([])
  await expect(page.getByTestId('font-status-banner')).toBeHidden()
  expect(fonts.counts.requestedWeights.every((weight) => weight === 400)).toBe(true)
  canvas.assertNoErrors()
})

test('font list stays usable while searching, loading previews, and resizing the window', async ({
  page
}) => {
  const errors = await trackResizeErrors(page)
  await mockGoogleFonts(
    page,
    Array.from({ length: 80 }, (_, index) => `Preview Font ${index}`),
    {
      fontData: await readFile(publicPath('Inter-Regular.ttf'))
    }
  )
  await trackFontModuleResources(page)
  await page.goto('/?test&no-rulers')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await createTypographyFixture(page, { google: true })
  await page.getByRole('button', { name: 'Font family', exact: true }).click()
  const search = page.getByRole('combobox', { name: 'Search fonts…' })
  for (const width of [1000, 1280, 1100, 1200]) {
    await search.fill('Preview Font 1')
    await page.getByTestId('font-picker-item').first().hover()
    await page.setViewportSize({ width, height: 800 })
    await search.fill('Preview')
    await expect(page.getByTestId('font-picker-item').first()).toBeVisible()
  }
  await search.fill('Preview Font 19')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'Font family', exact: true })).toHaveText(
    'Preview Font 19'
  )
  await canvas.waitForRender()
  expect(errors).toEqual([])
  canvas.assertNoErrors()
})
