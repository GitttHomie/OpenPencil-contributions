import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { setPixelGridViewport } from '#tests/helpers/canvas/pixel-grid'
import {
  createPixelSnappingFixture,
  readPixelSnappingGeometry
} from '#tests/helpers/canvas/pixel-snapping'
import { propertyField } from '#tests/helpers/properties'

const editor = useEditorSetupWithClear('/?test&no-rulers')

test('typed decimals survive, while dragging and resizing align the frame to the pixel grid', async () => {
  const { page, canvas } = editor
  const id = await createPixelSnappingFixture(page)
  await setPixelGridViewport(page, 16)
  const typed = { x: 2.3, y: 2.7, width: 22.3, height: 16.7 }
  for (const [property, value] of Object.entries(typed)) {
    const field = propertyField(page, property)
    await field.dblclick()
    const input = field.getByRole('spinbutton')
    await input.fill(String(value))
    await input.press('Enter')
    await expect(field).toContainText(String(value))
  }
  await expect.poll(() => readPixelSnappingGeometry(page, id)).toEqual(typed)
  await page.getByTestId('canvas-element').focus()
  await page.keyboard.press('ArrowRight')
  await expect.poll(() => readPixelSnappingGeometry(page, id)).toEqual({ ...typed, x: 3, y: 3 })
  await page.keyboard.press('Meta+z')
  await expect.poll(() => readPixelSnappingGeometry(page, id)).toEqual(typed)
  await canvas.drag(152, 144, 165, 155)
  await expect.poll(() => readPixelSnappingGeometry(page, id)).toEqual({ ...typed, x: 3, y: 3 })
  const right = 24 + (3 + typed.width) * 16
  const bottom = 16 + (3 + typed.height) * 16
  await canvas.drag(right, bottom, right + 7, bottom + 9)
  await expect
    .poll(() => readPixelSnappingGeometry(page, id))
    .toEqual({ x: 3, y: 3, width: 23, height: 17 })
  await page.keyboard.press('Escape')
  await page.mouse.move(900, 700)
  expect(await canvas.screenshotCanvasRegion(460, 380)).toMatchSnapshot('frame-on-pixels.png')
  canvas.assertNoErrors()
})
