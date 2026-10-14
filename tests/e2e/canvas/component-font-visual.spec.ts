import { expect, test } from '#tests/e2e/fixtures'
import { CanvasHelper } from '#tests/helpers/canvas'
import { createComponentFontFixture } from '#tests/helpers/fonts/component'

test('component font changes cover overridden instance labels without editing each instance', async ({
  page
}) => {
  await page.goto('/?test&no-chrome&no-rulers')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  const fixture = await createComponentFontFixture(page)
  try {
    await expect.poll(() => fixture.evaluate((state) => state.requestCount())).toBe(1)
    expect(await fixture.evaluate((state) => state.ready())).toBe(false)
    await fixture.evaluate((state) => state.finish())
    await expect.poll(() => fixture.evaluate((state) => state.ready())).toBe(true)
    await canvas.waitForRender()
    canvas.assertNoErrors()
    expect(await canvas.screenshotCanvasRegion()).toMatchSnapshot(
      'component-font-inheritance.png',
      {
        maxDiffPixelRatio: 0
      }
    )
  } finally {
    await fixture.evaluate((state) => state.restore())
    await fixture.dispose()
  }
})
