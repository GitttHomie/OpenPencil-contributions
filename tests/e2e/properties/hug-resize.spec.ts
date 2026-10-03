import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { createHugResizeFixture, readHugResizeGeometry } from '#tests/helpers/canvas/hug-resize'
import { setPixelGridViewport } from '#tests/helpers/canvas/pixel-grid'

const editor = useEditorSetupWithClear('/?test&no-rulers')

test('presets and resize handles preserve an overhanging badge on a nested Hug frame', async () => {
  const { page, canvas } = editor
  const ids = await createHugResizeFixture(page)
  await setPixelGridViewport(page, 2)
  const nodes = [ids.root, ids.hug, ids.badge]
  const before = await readHugResizeGeometry(page, nodes)
  const innerBefore = before.slice(1)
  await page.getByRole('combobox', { name: 'Frame preset' }).click()
  await page.getByRole('option', { name: 'Desktop', exact: true }).click()
  await expect
    .poll(async () => (await readHugResizeGeometry(page, nodes)).slice(1))
    .toEqual(innerBefore)
  await canvas.undo()
  await expect.poll(() => readHugResizeGeometry(page, nodes)).toEqual(before)
  await canvas.redo()
  await expect
    .poll(async () => (await readHugResizeGeometry(page, nodes)).slice(1))
    .toEqual(innerBefore)
  await canvas.undo()
  await canvas.drag(244, 276, 444, 376)
  const resized = [{ ...before[0], width: 200, height: 150 }, ...innerBefore]
  await expect.poll(() => readHugResizeGeometry(page, nodes)).toEqual(resized)
  await canvas.undo()
  await expect.poll(() => readHugResizeGeometry(page, nodes)).toEqual(before)
  await canvas.redo()
  await expect.poll(() => readHugResizeGeometry(page, nodes)).toEqual(resized)
  await page.keyboard.press('Escape')
  await page.mouse.move(900, 700)
  expect(await canvas.screenshotCanvasRegion(460, 420)).toMatchSnapshot('nested-hug-badge.png')
  canvas.assertNoErrors()
})
