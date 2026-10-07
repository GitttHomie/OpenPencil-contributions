import { readFile } from 'node:fs/promises'

import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { mockGoogleFonts } from '#tests/helpers/fonts/google'
import { mockLocalFont } from '#tests/helpers/fonts/local'
import { trackFontModuleResources } from '#tests/helpers/fonts/runtime'
import {
  createTypographyFixture,
  readTypography,
  selectTextForTypography,
  typographySelectionMatchesPaint
} from '#tests/helpers/fonts/typography'
import { publicPath } from '#tests/helpers/paths'

test('a regular-only local choice survives deselection during loading and undoes as one change', async ({
  page
}) => {
  let finish: (() => void) | undefined
  const download = new Promise<void>((resolve) => {
    finish = resolve
  })
  const counts = await mockLocalFont(
    page,
    await readFile(publicPath('Inter-Regular.ttf')),
    () => download
  )
  await trackFontModuleResources(page)
  await page.goto('/?test&no-rulers')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  const id = await createTypographyFixture(page)
  try {
    await page.getByRole('button', { name: 'Font family', exact: true }).click()
    await page.getByRole('combobox', { name: 'Search fonts…' }).fill('Academy')
    await page.getByTestId('font-picker-item').filter({ hasText: 'Academy Engraved LET' }).click()
    await expect.poll(() => counts.reads).toBe(1)
    await expect
      .poll(() => readTypography(page, id))
      .toMatchObject({
        fontFamily: 'Academy Engraved LET',
        fontWeight: 400
      })
    await expect(page.getByTestId('font-status-banner')).toBeHidden()
    await canvas.click(700, 500)
    finish?.()
    await expect
      .poll(() => readTypography(page, id))
      .toMatchObject({
        fontFamily: 'Academy Engraved LET',
        fontWeight: 400,
        fontSource: 'local'
      })
    await canvas.click(200, 200)
    await expect(page.getByRole('button', { name: 'Font family', exact: true })).toHaveText(
      'Academy Engraved LET'
    )
    await expect(page.getByTestId('font-status-banner')).toBeHidden()
    await page.getByTestId('canvas-element').focus()
    await page.keyboard.press('Meta+z')
    await expect
      .poll(() => readTypography(page, id))
      .toMatchObject({
        fontFamily: 'Inter',
        fontWeight: 600
      })
    expect(counts.reads).toBe(1)
    canvas.assertNoErrors()
  } finally {
    finish?.()
    await page.unrouteAll({ behavior: 'wait' })
  }
})

test('first Google font selection commits while SemiBold loads without a substitution warning', async ({
  page
}) => {
  let finish: (() => void) | undefined
  const download = new Promise<void>((resolve) => {
    finish = resolve
  })
  const fonts = await mockGoogleFonts(page, ['Downloaded Test Font'], {
    fontData: await readFile(publicPath('Inter-SemiBold.ttf')),
    weights: [400, 600],
    beforeDownload: () => download
  })
  await trackFontModuleResources(page)
  await page.goto('/?test&no-rulers')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  const id = await createTypographyFixture(page, { google: true })
  try {
    await page.getByRole('button', { name: 'Font family', exact: true }).click()
    await page.getByRole('combobox', { name: 'Search fonts…' }).fill('Downloaded Test Font')
    await expect(
      page.getByTestId('font-picker-item').filter({ hasText: 'Downloaded Test Font' })
    ).toBeVisible()
    expect(await readTypography(page, id)).toMatchObject({
      fontFamily: 'Inter',
      fontWeight: 600
    })
    await page.getByTestId('font-picker-item').filter({ hasText: 'Downloaded Test Font' }).click()
    await expect.poll(() => fonts.counts.requestedWeights).toContain(600)
    expect((await readTypography(page, id))?.fontFamily).toBe('Downloaded Test Font')
    await expect(page.getByTestId('font-status-banner')).toBeHidden()
    finish?.()
    await expect
      .poll(() => readTypography(page, id))
      .toMatchObject({
        fontFamily: 'Downloaded Test Font',
        fontWeight: 600,
        fontSource: 'google'
      })
    await canvas.waitForRender()
    await expect(page.getByTestId('font-status-banner')).toBeHidden()
    canvas.assertNoErrors()
  } finally {
    finish?.()
    await fonts.dispose()
  }
})

test('dragging font size uses whole steps and retains exact undo and typed decimals', async ({
  page
}) => {
  await trackFontModuleResources(page)
  await page.goto('/?test&no-rulers')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  const original = 36.92578125
  const id = await createTypographyFixture(page, { fontSize: original })
  const field = page.getByRole('spinbutton', { name: 'Font size', exact: true })
  const box = await field.boundingBox()
  if (!box) throw new Error('Font size unavailable')
  await page.mouse.move(box.x + 14.25, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + 22.6, box.y + box.height / 2, { steps: 4 })
  await page.mouse.up()
  const size = (await readTypography(page, id))?.fontSize
  expect(Number.isInteger(size)).toBe(true)
  expect(size).toBeGreaterThan(original)
  await page.getByTestId('canvas-element').focus()
  await page.keyboard.press('Meta+z')
  await expect.poll(async () => (await readTypography(page, id))?.fontSize).toBe(original)
  await field.click()
  await page.getByRole('spinbutton', { name: 'Font size', exact: true }).fill('36.5')
  await page.keyboard.press('Enter')
  await expect.poll(async () => (await readTypography(page, id))?.fontSize).toBe(36.5)
  canvas.assertNoErrors()
})

test('text selection follows painted line spacing after a font-size change', async ({ page }) => {
  await trackFontModuleResources(page)
  await page.goto('/?test&no-chrome&no-rulers')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  const id = await createTypographyFixture(page)
  await selectTextForTypography(page, id)
  await selectTextForTypography(page, id, 38)
  await canvas.waitForRender()
  const { selected, lines } = await typographySelectionMatchesPaint(page, id)
  expect(selected).toHaveLength(lines.length)
  selected.forEach((rect, index) => {
    expect(rect.x).toBeCloseTo(lines[index].x)
    expect(rect.y).toBeCloseTo(lines[index].top)
    expect(rect.y + rect.height).toBeCloseTo(lines[index].bottom)
  })
  await page.mouse.move(10, 10)
  expect(await canvas.screenshotCanvasRegion(560, 430)).toMatchSnapshot(
    'text-selection-line-spacing.png'
  )
  canvas.assertNoErrors()
})
