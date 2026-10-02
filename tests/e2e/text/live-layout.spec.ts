import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { expectDefined } from '#tests/helpers/assert'
import { getNodeById } from '#tests/helpers/store'
import { createHugTextFixture, holdTextCaretVisible, readTextEdit } from '#tests/helpers/text-edit'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

test('Hug frames follow typing, deletion, and undo without another layout edit', async () => {
  const { frameId, textId, siblingId } = await createHugTextFixture(editor.page)
  const initial = expectDefined(await getNodeById(editor.page, frameId), 'initial frame')
  await editor.page.keyboard.press('Enter')
  await expect(editor.page.locator('textarea[aria-hidden="true"]')).toBeFocused()
  await editor.page.keyboard.insertText('A much longer label')
  await expect
    .poll(() => readTextEdit(editor.page))
    .toMatchObject({
      id: textId,
      text: 'A much longer label'
    })
  await expect
    .poll(async () => (await getNodeById(editor.page, frameId))?.width)
    .toBeGreaterThan(initial.width)
  const text = expectDefined(await getNodeById(editor.page, textId), 'text')
  const sibling = expectDefined(await getNodeById(editor.page, siblingId), 'sibling')
  expect(sibling.x).toBeCloseTo(16 + text.width + 12)
  expect((await readTextEdit(editor.page)).id).toBe(textId)

  await editor.page.keyboard.press('Meta+a')
  await editor.page.keyboard.insertText('Hi')
  await expect
    .poll(async () => (await getNodeById(editor.page, frameId))?.width)
    .toBeLessThan(initial.width)
  const shortened = expectDefined(await getNodeById(editor.page, frameId), 'shortened frame')
  await editor.page.keyboard.press('Escape')
  await editor.canvas.undo()
  await expect
    .poll(async () => (await getNodeById(editor.page, frameId))?.width)
    .toBeCloseTo(initial.width)
  await editor.canvas.redo()
  await expect
    .poll(async () => (await getNodeById(editor.page, frameId))?.width)
    .toBeCloseTo(shortened.width)
  editor.canvas.assertNoErrors()
})

test('an empty trailing line keeps a visible clickable caret and deletes normally', async () => {
  const { frameId, textId } = await createHugTextFixture(editor.page)
  const initial = expectDefined(await getNodeById(editor.page, frameId), 'initial frame')
  await editor.page.keyboard.press('Enter')
  await expect(editor.page.locator('textarea[aria-hidden="true"]')).toBeFocused()
  await editor.page.keyboard.press('ArrowRight')
  await editor.page.keyboard.press('Enter')
  const multiline = await readTextEdit(editor.page)
  expect(multiline.text).toBe('Hello\n')
  expect(multiline.cursor).toBe(6)
  expect(expectDefined(multiline.caret, 'caret').y0).toBeGreaterThan(20)
  await expect
    .poll(async () => (await getNodeById(editor.page, frameId))?.height)
    .toBeGreaterThan(initial.height)

  const caretVisibility = await holdTextCaretVisible(editor.page)
  try {
    await editor.canvas.waitForRender()
    expect(await editor.canvas.screenshotCanvasRegion(500, 300)).toMatchSnapshot(
      'hug-text-empty-line-caret.png'
    )
  } finally {
    await caretVisibility.evaluate((handle) => handle.restore())
    await caretVisibility.dispose()
  }

  await editor.page.keyboard.press('ArrowUp')
  const point = expectDefined(multiline.caretPoint, 'empty line click point')
  await editor.canvas.click(point.x, point.y)
  expect((await readTextEdit(editor.page)).id).toBe(textId)
  expect((await readTextEdit(editor.page)).cursor).toBe(6)
  await editor.page.keyboard.press('Home')
  await editor.page.keyboard.press('Backspace')
  expect((await readTextEdit(editor.page)).text).toBe('Hello')
  await expect
    .poll(async () => (await getNodeById(editor.page, frameId))?.height)
    .toBeCloseTo(initial.height)
  editor.canvas.assertNoErrors()
})
