import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import {
  beginGradientDrag,
  createGradientFixture,
  gradientPointOnScreen,
  readGradientHandles
} from '#tests/helpers/canvas/gradient'

const editor = useEditorSetupWithClear('/?test&no-rulers')

for (const transformed of [false, true]) {
  test(`snap gradient between corners and same-edge endpoints${transformed ? ' on a rotated, flipped frame' : ''}`, async () => {
    const { page, canvas } = editor
    const fixture = await createGradientFixture(page, 'GRADIENT_LINEAR', transformed)
    await page.getByTestId('fill-picker-swatch').click()
    const start = page.getByRole('button', { name: 'Gradient start', exact: true })
    const end = page.getByRole('button', { name: 'Gradient end', exact: true })
    await beginGradientDrag(
      page,
      start,
      await gradientPointOnScreen(page, fixture.id, { x: 2, y: 3 })
    )
    await expect(page.locator('[data-gradient-snap-guide]')).toHaveCount(2)
    await page.mouse.up()
    await expect
      .poll(async () => (await readGradientHandles(page, fixture.id)).start)
      .toEqual({ x: 0, y: 0 })
    await beginGradientDrag(
      page,
      end,
      await gradientPointOnScreen(page, fixture.id, { x: 238, y: 177 })
    )
    await expect(page.locator('[data-gradient-snap-guide]')).toHaveCount(2)
    expect(await canvas.screenshotCanvasRegion(540, 440)).toMatchSnapshot(
      `gradient-corner-snap${transformed ? '-rotated' : ''}.png`
    )
    await page.mouse.up()
    await expect
      .poll(async () => (await readGradientHandles(page, fixture.id)).end)
      .toEqual({ x: 240, y: 180 })
    await beginGradientDrag(
      page,
      end,
      await gradientPointOnScreen(page, fixture.id, { x: 2, y: 177 })
    )
    await page.mouse.up()
    await expect
      .poll(async () => (await readGradientHandles(page, fixture.id)).end)
      .toEqual({ x: 0, y: 180 })
    await page.keyboard.down('Alt')
    await beginGradientDrag(
      page,
      end,
      await gradientPointOnScreen(page, fixture.id, { x: 3, y: 176 })
    )
    await expect(page.locator('[data-gradient-snap-guide]')).toHaveCount(0)
    await page.mouse.up()
    await page.keyboard.up('Alt')
    const free = await readGradientHandles(page, fixture.id)
    expect(free.end.x).toBeCloseTo(3, 1)
    expect(free.end.y).toBeCloseTo(176, 1)
    await page.keyboard.press('Escape')
    canvas.assertNoErrors()
  })
}
