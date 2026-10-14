import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { createStretchingAnnotation } from '#tests/helpers/canvas/vector-strokes'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

test('layout stretches measurement paths without enlarging their strokes', async () => {
  expect(await createStretchingAnnotation(editor.page)).toEqual([1, 1, 1])
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  expect(await editor.canvas.screenshotCanvasRegion(600, 350)).toMatchSnapshot(
    'measurement-strokes.png'
  )
})
