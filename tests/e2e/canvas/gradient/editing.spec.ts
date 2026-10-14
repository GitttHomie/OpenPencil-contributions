import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import {
  beginGradientDrag,
  gradientHandleOnScreen,
  createGradientFixture,
  gradientPointOnScreen,
  readGradient,
  readGradientHandles
} from '#tests/helpers/canvas/gradient/scene'

const editor = useEditorSetupWithClear('/?test&no-rulers')

test('linear handles follow rotated and reflected ancestors, update live, cancel and undo', async () => {
  const { page, canvas } = editor
  const fixture = await createGradientFixture(page, 'GRADIENT_LINEAR', true)
  await page.getByTestId('fill-picker-swatch').click()
  const start = 'start' as const
  await gradientHandleOnScreen(page, start)
  const original = await readGradientHandles(page, fixture.id)
  const expected = await gradientPointOnScreen(page, fixture.id, original.start)
  expect(await gradientHandleOnScreen(page, start)).toEqual(expected)
  const destination = await gradientPointOnScreen(page, fixture.id, { x: 170, y: 150 })
  await page.keyboard.down('Alt')
  await beginGradientDrag(page, start, destination)
  // Browser pointer coordinates are integer CSS pixels, including through rotated ancestors.
  await expect
    .poll(async () => Math.abs((await readGradientHandles(page, fixture.id)).start.x - 170))
    .toBeLessThan(1.5)
  await expect(page.locator('[data-picker-content]')).toBeVisible()
  await page.mouse.up()
  await page.keyboard.up('Alt')
  expect(await readGradient(page, fixture.id)).toMatchObject({ x: 50, y: 40 })
  await canvas.waitForRender()
  expect(await canvas.screenshotCanvasRegion(540, 440)).toMatchSnapshot(
    'rotated-linear-gradient-handles.png'
  )
  await page.keyboard.press('Meta+z')
  await expect.poll(async () => (await readGradient(page, fixture.id)).fill).toEqual(fixture.fill)
  await page.keyboard.down('Alt')
  await beginGradientDrag(page, start, destination)
  await page.keyboard.press('Escape')
  await page.mouse.up()
  await page.keyboard.up('Alt')
  await expect.poll(async () => (await readGradient(page, fixture.id)).fill).toEqual(fixture.fill)
  canvas.assertNoErrors()
  await page.keyboard.press('Escape')
})

for (const type of ['GRADIENT_RADIAL', 'GRADIENT_ANGULAR', 'GRADIENT_DIAMOND'] as const) {
  test(`${type} moves and rotates from the canvas without closing the picker`, async () => {
    const { page, canvas } = editor
    const fixture = await createGradientFixture(page, type)
    await page.getByTestId('fill-picker-swatch').click()
    const center = 'center' as const
    await gradientHandleOnScreen(page, center)
    await beginGradientDrag(
      page,
      center,
      await gradientPointOnScreen(page, fixture.id, { x: 145, y: 110 })
    )
    await page.mouse.up()
    await page.keyboard.up('Alt')
    const radius = 'radius-x' as const
    await beginGradientDrag(
      page,
      radius,
      await gradientPointOnScreen(page, fixture.id, { x: 180, y: 165 })
    )
    await page.mouse.up()
    await page.keyboard.up('Alt')
    await gradientHandleOnScreen(page, radius)
    const changed = (await readGradient(page, fixture.id)).fill
    expect(changed.gradientTransform).not.toEqual(fixture.fill.gradientTransform)
    const handles = await readGradientHandles(page, fixture.id)
    expect(Math.abs(handles.end.x - 180)).toBeLessThan(1.5)
    await canvas.waitForRender()
    expect(await canvas.screenshotCanvasRegion(540, 440)).toMatchSnapshot(
      `${type.toLowerCase()}-handles.png`
    )
    canvas.assertNoErrors()
    await page.keyboard.press('Escape')
  })
}
