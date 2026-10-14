import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { blurEffectsDriver } from '#tests/helpers/canvas/effects/driver'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers&navigation-benchmark')
const scene = blurEffectsDriver(() => editor.page)

test('invalid imported geometry does not erase its containing frame', async () => {
  const { invalidId } = await scene.showImported()
  await scene.settle()
  const valid = await editor.canvas.screenshotCanvasRegion()
  await scene.showInvalidNode(invalidId)
  await scene.settle()
  editor.canvas.assertNoErrors()
  const actual = await editor.canvas.screenshotCanvasRegion()
  expect(actual.equals(valid)).toBe(true)
  expect(actual).toMatchSnapshot('imported-effects.png')
})
