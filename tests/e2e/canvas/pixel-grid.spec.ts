import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import {
  createPixelGridFixture,
  exportPixelGridSample,
  readPixelGridState,
  setPixelGridViewport
} from '#tests/helpers/canvas/pixel-grid'

const editor = useEditorSetupWithClear('/?test&no-rulers')

test('zoom and View menus share pixel-grid visibility; keyboard toggles it without changing snapping or exports', async () => {
  const { page, canvas } = editor
  const id = await createPixelGridFixture(page)
  await setPixelGridViewport(page, 8)
  const exported = await exportPixelGridSample(page, id)
  const before = await readPixelGridState(page)
  await page.getByTestId('zoom-dropdown-trigger').click()
  const checkbox = page.getByRole('menuitemcheckbox', { name: 'Pixel grid', exact: false })
  await expect(checkbox).not.toBeChecked()
  await checkbox.click()
  await expect(checkbox).toBeChecked()
  await page.keyboard.press('Escape')
  await page.getByRole('menuitem', { name: 'View', exact: true }).click()
  await expect(checkbox).toBeChecked()
  await page.keyboard.press('Escape')
  await expect.poll(() => readPixelGridState(page)).toEqual({ ...before, visible: true })
  expect(await exportPixelGridSample(page, id)).toEqual(exported)
  expect(await canvas.screenshotCanvasRegion(320, 240)).toMatchSnapshot('pixel-grid-800.png')
  await page.getByTestId('canvas-element').focus()
  await page.keyboard.press('Meta+Shift+p')
  await expect.poll(() => readPixelGridState(page)).toEqual({ ...before, visible: false })
  expect(await canvas.screenshotCanvasRegion(320, 240)).toMatchSnapshot('pixel-grid-hidden.png')
  await page.getByTestId('zoom-dropdown-trigger').click()
  await expect(checkbox).not.toBeChecked()
  await page.keyboard.press('Escape')
  canvas.assertNoErrors()
})

test('pixel grid follows fractional zoom and negative pan, and hides below 800%', async () => {
  const { page, canvas } = editor
  await createPixelGridFixture(page)
  await setPixelGridViewport(page, 10.5, -12.25, 16.25)
  await page.getByTestId('canvas-element').focus()
  await page.keyboard.press('Meta+Shift+p')
  await expect.poll(() => readPixelGridState(page)).toMatchObject({ visible: true })
  expect(await canvas.screenshotCanvasRegion(320, 240)).toMatchSnapshot('pixel-grid-fractional.png')
  await setPixelGridViewport(page, 4)
  const lowZoom = await canvas.screenshotCanvasRegion(320, 240)
  await page.keyboard.press('Meta+Shift+p')
  expect(await canvas.screenshotCanvasRegion(320, 240)).toEqual(lowZoom)
  canvas.assertNoErrors()
})
