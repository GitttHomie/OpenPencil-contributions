import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import {
  beginGradientDrag,
  createGradientFixture,
  gradientPointOnScreen,
  readGradient
} from '#tests/helpers/canvas/gradient'

const editor = useEditorSetupWithClear('/?test&no-rulers')

test('linear handles follow rotated and reflected ancestors, update live, cancel and undo', async () => {
  const { page, canvas } = editor
  const fixture = await createGradientFixture(page, 'GRADIENT_LINEAR', true)
  await page.getByTestId('fill-picker-swatch').click()
  const start = page.getByRole('button', { name: 'Gradient start', exact: true })
  await expect(start).toBeVisible()
  const expected = await gradientPointOnScreen(page, fixture.id, { x: 216, y: 90 })
  const box = await start.boundingBox()
  expect(box).not.toBeNull()
  expect((box?.x ?? 0) + (box?.width ?? 0) / 2).toBeCloseTo(expected.x, 0)
  expect((box?.y ?? 0) + (box?.height ?? 0) / 2).toBeCloseTo(expected.y, 0)
  const destination = await gradientPointOnScreen(page, fixture.id, { x: 170, y: 150 })
  await beginGradientDrag(page, start, destination)
  await expect
    .poll(async () => (await readGradient(page, fixture.id)).fill.gradientTransform?.m10)
    .toBeCloseTo(1 / 3, 2)
  await expect(page.locator('[data-picker-content]')).toBeVisible()
  await page.mouse.up()
  expect(await readGradient(page, fixture.id)).toMatchObject({ x: 50, y: 40 })
  await canvas.waitForRender()
  expect(await canvas.screenshotCanvasRegion(540, 440)).toMatchSnapshot(
    'rotated-linear-gradient-handles.png'
  )
  await page.keyboard.press('Meta+z')
  await expect.poll(async () => (await readGradient(page, fixture.id)).fill).toEqual(fixture.fill)
  await beginGradientDrag(page, start, destination)
  await page.keyboard.press('Escape')
  await page.mouse.up()
  await expect.poll(async () => (await readGradient(page, fixture.id)).fill).toEqual(fixture.fill)
  canvas.assertNoErrors()
  await page.keyboard.press('Escape')
})

for (const type of ['GRADIENT_RADIAL', 'GRADIENT_ANGULAR', 'GRADIENT_DIAMOND'] as const) {
  test(`${type} moves and rotates from the canvas without closing the picker`, async () => {
    const { page, canvas } = editor
    const fixture = await createGradientFixture(page, type)
    await page.getByTestId('fill-picker-swatch').click()
    const center = page.getByRole('button', { name: 'Move gradient', exact: true })
    await expect(center).toBeVisible()
    await beginGradientDrag(
      page,
      center,
      await gradientPointOnScreen(page, fixture.id, { x: 145, y: 110 })
    )
    await page.mouse.up()
    const radius = page.getByRole('button', { name: 'Rotate and resize gradient', exact: true })
    await beginGradientDrag(
      page,
      radius,
      await gradientPointOnScreen(page, fixture.id, { x: 180, y: 165 })
    )
    await page.mouse.up()
    await expect(radius).toBeVisible()
    const changed = (await readGradient(page, fixture.id)).fill
    expect(changed.gradientTransform?.m10).toBeGreaterThan(0.5)
    expect(changed.gradientTransform?.m01).toBeLessThan(0)
    await canvas.waitForRender()
    expect(await canvas.screenshotCanvasRegion(540, 440)).toMatchSnapshot(
      `${type.toLowerCase()}-handles.png`
    )
    canvas.assertNoErrors()
    await page.keyboard.press('Escape')
  })
}
