import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'
import { captureSavePicker, editorUIVisible } from '#tests/helpers/keyboard/document'
import { propertyField } from '#tests/helpers/properties'
import { removeInspectedSelection } from '#tests/helpers/properties/number-field'

const editor = useEditorSetup()

test.beforeEach(async () => {
  await editor.canvas.clearCanvas()
  await editor.canvas.drawRect(120, 100, 80, 80)
})

test('Save works while a numeric inspector field is focused', async () => {
  const picker = await captureSavePicker(editor.page)
  try {
    const field = propertyField(editor.page, 'x')
    await field.click()
    const input = field.getByRole('spinbutton', { name: 'X Axis' })
    await input.fill('77')
    await input.press('ControlOrMeta+KeyS')
    await expect.poll(() => picker.evaluate((state) => state.calls)).toBe(1)
    await expect(input).toBeFocused()
    await input.press('Escape')
    editor.canvas.assertNoErrors()
  } finally {
    await picker.evaluate((state) => state.restore())
    await picker.dispose()
  }
})

test('Save and UI toggle survive removal of a focused inspector field', async () => {
  const picker = await captureSavePicker(editor.page)
  try {
    const field = propertyField(editor.page, 'x')
    await field.click()
    const input = field.getByRole('spinbutton', { name: 'X Axis' })
    await removeInspectedSelection(editor.page)
    await expect(input).toBeHidden()
    await editor.canvas.click(450, 350)
    await editor.page.keyboard.press('ControlOrMeta+Backslash')
    await expect.poll(() => editorUIVisible(editor.page)).toBe(false)
    await editor.page.keyboard.press('ControlOrMeta+Shift+Backslash')
    await expect.poll(() => editorUIVisible(editor.page)).toBe(true)
    await editor.page.keyboard.press('ControlOrMeta+KeyS')
    await expect.poll(() => picker.evaluate((state) => state.calls)).toBe(1)
    editor.canvas.assertNoErrors()
  } finally {
    await picker.evaluate((state) => state.restore())
    await picker.dispose()
  }
})
