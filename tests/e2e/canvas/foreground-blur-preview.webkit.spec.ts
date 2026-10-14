import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { blurEffectsDriver } from '#tests/helpers/canvas/effects/driver'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers&navigation-benchmark')
const scene = blurEffectsDriver(() => editor.page)

test('moving a blurred shape reuses its image and restores exact settled rendering', async () => {
  const { glowId } = await scene.showImported()
  await scene.settle()
  const settled = await editor.canvas.screenshotCanvasRegion()
  const preview = await scene.preview(glowId)
  try {
    await preview.evaluate((gesture) => gesture.move())
    await editor.canvas.waitForRender()
    expect(await preview.evaluate((gesture) => gesture.reusesImage())).toBe(true)
    expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot('moving-blurred-shape.png')
  } finally {
    await preview.evaluate((gesture) => gesture.restore())
    await preview.dispose()
  }
  await scene.settle()
  editor.canvas.assertNoErrors()
  expect((await editor.canvas.screenshotCanvasRegion()).equals(settled)).toBe(true)
})
