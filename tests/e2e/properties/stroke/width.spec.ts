import { expect, test } from '@playwright/test'

import { propertyField, propertySection } from '#tests/helpers/properties'
import { createStrokeWidthScene } from '#tests/helpers/stroke-width'

test('uniform stroke width changes the canvas and supports undo', async ({ page }) => {
  const scene = await createStrokeWidthScene(page)
  const before = await page.screenshot()
  const field = propertyField(page, 'stroke-weight')
  await field.click()
  await field.getByRole('spinbutton').fill('12')
  await field.getByRole('spinbutton').press('Enter')
  await expect.poll(async () => (await scene.read(0)).top).toBe(12)
  expect(await scene.read(0)).toMatchObject({ top: 12, right: 12, bottom: 12, left: 12 })
  await scene.canvas.waitForRender()
  const after = await page.screenshot()
  expect(after.equals(before)).toBe(false)
  await expect(after).toMatchSnapshot('uniform-border-12.png')
  await test.info().attach('stroke-controls', {
    body: await propertySection(page, 'Stroke').screenshot(),
    contentType: 'image/png'
  })
  await page.getByTestId('canvas-element').focus()
  await page.keyboard.press('Meta+z')
  await expect.poll(async () => (await scene.read(0)).independent).toBe(false)
  await expect.poll(async () => (await scene.read(0)).weight).toBe(2)
  scene.canvas.assertNoErrors()
})

test('collapsing stroke controls preserves sides and undo restores the last edit', async ({
  page
}) => {
  const scene = await createStrokeWidthScene(page)
  await scene.select(1)
  const top = propertyField(page, 'stroke-top-weight')
  await expect(top).toBeVisible()
  await expect(top).toContainText('3')
  await expect(propertyField(page, 'stroke-weight')).toBeHidden()
  await top.click()
  await top.getByRole('spinbutton').fill('14')
  await top.getByRole('spinbutton').press('Enter')
  await expect.poll(async () => (await scene.read(1)).top).toBe(14)
  await scene.select(0)
  await expect(propertyField(page, 'stroke-weight')).toBeVisible()
  await expect(top).toBeHidden()
  await scene.select(1)
  await expect(top).toContainText('14')
  await propertyField(page, 'stroke-sides').click()
  await expect(propertyField(page, 'stroke-weight')).toBeVisible()
  await page.getByTestId('canvas-element').focus()
  await page.keyboard.press('Meta+z')
  await expect.poll(async () => (await scene.read(1)).independent).toBe(true)
  await expect(propertyField(page, 'stroke-weight')).toBeVisible()
  await expect.poll(async () => (await scene.read(1)).top).toBe(3)
  await propertyField(page, 'stroke-sides').click()
  await expect(top).toBeVisible()
  await expect(top).toContainText('3')
  scene.canvas.assertNoErrors()
})

test('line stroke width remains editable without per-side border controls', async ({ page }) => {
  const scene = await createStrokeWidthScene(page)
  await scene.select(2)
  await expect(propertyField(page, 'stroke-sides')).toBeHidden()
  const field = propertyField(page, 'stroke-weight')
  await field.click()
  await field.getByRole('spinbutton').fill('8')
  await field.getByRole('spinbutton').press('Enter')
  await expect.poll(async () => (await scene.read(2)).weight).toBe(8)
  expect((await scene.read(2)).independent).toBe(false)
  await scene.canvas.pressKey('Meta+z')
  await expect.poll(async () => (await scene.read(2)).weight).toBe(2)
})

test('grouped border edits preserve rounded and smoothed corners', async ({ page }) => {
  const scene = await createStrokeWidthScene(page, true)
  const field = propertyField(page, 'stroke-weight')
  await field.click()
  await field.getByRole('spinbutton').fill('12')
  await field.getByRole('spinbutton').press('Enter')
  await scene.canvas.waitForRender()
  await expect(page).toHaveScreenshot('rounded-border-12.png')
  await propertyField(page, 'stroke-sides').click()
  const top = propertyField(page, 'stroke-top-weight')
  await expect(top).toContainText('12')
  expect(await scene.read(0)).toMatchObject({ top: 12, right: 12, bottom: 12, left: 12 })
  scene.canvas.assertNoErrors()
})
