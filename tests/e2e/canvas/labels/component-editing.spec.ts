import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { createComponentLabelScene, readLayerName } from '#tests/helpers/component-labels'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

test('definitions and instances have distinct canvas icons and inherit smooth corners', async () => {
  await createComponentLabelScene(editor.page)
  await editor.page.mouse.move(10, 10)
  await editor.canvas.waitForRender()
  expect(await editor.canvas.screenshotCanvasRegion(650, 560)).toMatchSnapshot(
    'component-instance-labels.png'
  )
  editor.canvas.assertNoErrors()
})

for (const kind of ['component', 'instance', 'frame'] as const) {
  test(`double-clicking the ${kind} label renames inline with undo and cancellation`, async () => {
    const nodes = await createComponentLabelScene(editor.page)
    const id = nodes[kind]
    const before = await readLayerName(editor.page, id)
    const position = { x: kind === 'instance' ? 385 : 105, y: kind === 'frame' ? 330 : 90 }
    const canvas = editor.page.getByTestId('canvas-element')
    await editor.canvas.waitForRender()
    await canvas.dblclick({ position })
    const input = editor.page.getByRole('textbox', { name: 'Layer name' })
    await expect(input).toBeVisible()
    await expect(input).toHaveValue(before ?? '')
    await input.fill('Renamed on canvas')
    await input.press('Enter')
    await expect(input).toBeHidden()
    await expect.poll(() => readLayerName(editor.page, id)).toBe('Renamed on canvas')
    await canvas.focus()
    await editor.page.keyboard.press('Meta+z')
    await expect.poll(() => readLayerName(editor.page, id)).toBe(before)
    await canvas.dblclick({ position })
    await expect(input).toBeVisible()
    await input.fill('Discard this')
    await input.press('Escape')
    await expect(input).toBeHidden()
    await expect.poll(() => readLayerName(editor.page, id)).toBe(before)
    editor.canvas.assertNoErrors()
  })
}
