import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { createLabelDragScene, readLabelDragGeometry } from '#tests/helpers/canvas/labels'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

for (const type of ['FRAME', 'COMPONENT', 'INSTANCE'] as const) {
  test(`dragging the ${type} name moves its children together and supports undo`, async () => {
    const id = await createLabelDragScene(editor.page, type)
    await editor.canvas.waitForRender()
    const canvas = editor.page.getByTestId('canvas-element')
    const box = await canvas.boundingBox()
    if (!box) throw new Error('Canvas unavailable')
    const start = { x: box.x + 180, y: box.y + (type === 'FRAME' ? 142 : 144) }
    const before = await readLabelDragGeometry(editor.page, id)
    await editor.page.mouse.move(start.x, start.y)
    await expect(canvas).toHaveCSS('cursor', 'move')
    await editor.page.mouse.down()
    await editor.page.mouse.move(start.x + 80, start.y + 50, { steps: 5 })
    await editor.page.mouse.up()
    const after = {
      x: 200,
      y: 210,
      width: 120,
      height: 100,
      rotation: 0,
      children: [{ x: 12, y: 18, world: { x: 212, y: 228 } }]
    }
    await expect.poll(() => readLabelDragGeometry(editor.page, id)).toEqual(after)
    await expect(editor.page.getByRole('textbox', { name: 'Layer name' })).toBeHidden()
    await editor.page.keyboard.press('Meta+z')
    await expect.poll(() => readLabelDragGeometry(editor.page, id)).toEqual(before)
    await editor.page.keyboard.press('Meta+Shift+z')
    await expect.poll(() => readLabelDragGeometry(editor.page, id)).toEqual(after)
    editor.canvas.assertNoErrors()
  })
}

test('a locked frame cannot be moved by dragging its name', async () => {
  const id = await createLabelDragScene(editor.page, 'FRAME', true)
  await editor.canvas.waitForRender()
  const canvas = editor.page.getByTestId('canvas-element')
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Canvas unavailable')
  const before = await readLabelDragGeometry(editor.page, id)
  await editor.page.mouse.move(box.x + 180, box.y + 142)
  await expect(canvas).not.toHaveCSS('cursor', 'move')
  await editor.page.mouse.down()
  await editor.page.mouse.move(box.x + 260, box.y + 192, { steps: 5 })
  await editor.page.mouse.up()
  await expect.poll(() => readLabelDragGeometry(editor.page, id)).toEqual(before)
  editor.canvas.assertNoErrors()
})
