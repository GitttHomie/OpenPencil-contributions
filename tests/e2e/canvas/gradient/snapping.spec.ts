import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import {
  beginGradientDrag,
  gradientGuideCount,
  createGradientFixture,
  gradientPointOnScreen,
  readGradientHandles
} from '#tests/helpers/canvas/gradient/scene'

const editor = useEditorSetupWithClear('/?test&no-rulers')

for (const transformed of [false, true]) {
  test(`snap gradient between corners and same-edge endpoints${transformed ? ' on a rotated, flipped frame' : ''}`, async () => {
    const { page, canvas } = editor
    const fixture = await createGradientFixture(page, 'GRADIENT_LINEAR', transformed)
    await page.getByTestId('fill-picker-swatch').click()
    const start = 'start' as const
    const end = 'end' as const
    await beginGradientDrag(
      page,
      start,
      await gradientPointOnScreen(page, fixture.id, { x: 2, y: 3 })
    )
    await expect.poll(() => gradientGuideCount(page)).toBe(2)
    await page.mouse.up()
    await expect
      .poll(async () => (await readGradientHandles(page, fixture.id)).start)
      .toEqual({ x: expect.closeTo(0, 6), y: expect.closeTo(0, 6) })
    await beginGradientDrag(
      page,
      end,
      await gradientPointOnScreen(page, fixture.id, { x: 238, y: 177 })
    )
    await expect.poll(() => gradientGuideCount(page)).toBe(2)
    expect(await canvas.screenshotCanvasRegion(540, 440)).toMatchSnapshot(
      `gradient-corner-snap${transformed ? '-rotated' : ''}.png`
    )
    await page.mouse.up()
    await expect
      .poll(async () => (await readGradientHandles(page, fixture.id)).end)
      .toEqual({ x: expect.closeTo(240, 6), y: expect.closeTo(180, 6) })
    await beginGradientDrag(
      page,
      end,
      await gradientPointOnScreen(page, fixture.id, { x: 2, y: 177 })
    )
    await page.mouse.up()
    await expect
      .poll(async () => (await readGradientHandles(page, fixture.id)).end)
      .toEqual({ x: expect.closeTo(0, 6), y: expect.closeTo(180, 6) })
    await page.keyboard.down('Alt')
    await beginGradientDrag(
      page,
      end,
      await gradientPointOnScreen(page, fixture.id, { x: 3, y: 176 })
    )
    await expect.poll(() => gradientGuideCount(page)).toBe(0)
    await page.mouse.up()
    await page.keyboard.up('Alt')
    const free = await readGradientHandles(page, fixture.id)
    expect(Math.abs(free.end.x - 3)).toBeLessThan(1.5)
    expect(Math.abs(free.end.y - 176)).toBeLessThan(1.5)
    await page.keyboard.press('Escape')
    canvas.assertNoErrors()
  })
}
