import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { expectDefined } from '#tests/helpers/assert'
import { getNodeById } from '#tests/helpers/store'
import {
  addHugBadgeNumber,
  addTextBadge,
  createHugTextFixture,
  holdTextCaretVisible,
  readTextEdit
} from '#tests/helpers/text-edit'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

test('an excluded Hug badge grows left while its number is edited and retains its anchor through history', async () => {
  const { frameId } = await createHugTextFixture(editor.page)
  const badgeId = await addTextBadge(editor.page, frameId)
  const numberId = await addHugBadgeNumber(editor.page, badgeId)
  async function badgeState() {
    const frame = expectDefined(await getNodeById(editor.page, frameId))
    const badge = expectDefined(await getNodeById(editor.page, badgeId))
    const number = expectDefined(await getNodeById(editor.page, numberId))
    expect(badge.x + badge.width - frame.width).toBeCloseTo(8.25)
    expect(badge.y).toBe(-8.25)
    expect(number.x + number.width).toBeCloseTo(badge.width - 6)
    return badge
  }
  const initial = await badgeState()
  await editor.page.keyboard.press('Enter')
  await expect(editor.page.locator('textarea[aria-hidden="true"]')).toBeFocused()
  await editor.page.keyboard.press('Meta+a')
  await editor.page.keyboard.insertText('99999')
  await expect
    .poll(async () => (await getNodeById(editor.page, badgeId))?.width)
    .toBeGreaterThan(initial.width)
  const grown = await badgeState()
  expect(grown.x).toBeLessThan(initial.x)
  const caret = await holdTextCaretVisible(editor.page)
  try {
    await editor.canvas.waitForRender()
    expect(await editor.canvas.screenshotCanvasRegion(500, 300)).toMatchSnapshot(
      'hug-badge-right-anchored-growth.png'
    )
  } finally {
    await caret.evaluate((handle) => handle.restore())
    await caret.dispose()
  }
  await editor.page.keyboard.press('Escape')
  await editor.canvas.undo()
  expect((await badgeState()).width).toBe(initial.width)
  await editor.canvas.redo()
  expect((await badgeState()).width).toBe(grown.width)
  await editor.page.keyboard.press('Enter')
  const input = editor.page.locator('textarea[aria-hidden="true"]')
  await expect(input).toBeFocused()
  await expect.poll(() => readTextEdit(editor.page)).toMatchObject({ id: numberId, text: '99999' })
  await editor.page.keyboard.press('Meta+a')
  await editor.page.keyboard.insertText('9')
  await expect.poll(() => readTextEdit(editor.page)).toMatchObject({ id: numberId, text: '9' })
  await expect
    .poll(async () => (await getNodeById(editor.page, badgeId))?.width)
    .toBeLessThan(grown.width)
  await badgeState()
  await editor.page.keyboard.press('Escape')
  editor.canvas.assertNoErrors()
})

test('an excluded top-right badge follows a Hug button while typing, deleting, undoing and redoing', async () => {
  const { frameId } = await createHugTextFixture(editor.page)
  const badgeId = await addTextBadge(editor.page, frameId)
  const initial = expectDefined(await getNodeById(editor.page, frameId), 'initial button')
  async function expectAnchored() {
    const frame = expectDefined(await getNodeById(editor.page, frameId), 'button')
    const badge = expectDefined(await getNodeById(editor.page, badgeId), 'badge')
    expect(badge.x + badge.width - frame.width).toBeCloseTo(8.25)
    expect(badge.y).toBe(-8.25)
    expect([badge.width, badge.height]).toEqual([24, 24])
    return frame
  }
  await editor.page.keyboard.press('Enter')
  await expect(editor.page.locator('textarea[aria-hidden="true"]')).toBeFocused()
  await editor.page.keyboard.insertText('A much longer label')
  await expect
    .poll(async () => (await getNodeById(editor.page, frameId))?.width)
    .toBeGreaterThan(initial.width)
  await expectAnchored()
  const caret = await holdTextCaretVisible(editor.page)
  try {
    await editor.canvas.waitForRender()
    expect(await editor.canvas.screenshotCanvasRegion(500, 300)).toMatchSnapshot(
      'hug-button-top-right-badge.png'
    )
  } finally {
    await caret.evaluate((handle) => handle.restore())
    await caret.dispose()
  }

  await editor.page.keyboard.press('Meta+a')
  await editor.page.keyboard.insertText('Hi\nHi')
  await expect
    .poll(async () => (await getNodeById(editor.page, frameId))?.width)
    .toBeLessThan(initial.width)
  const shortened = await expectAnchored()
  expect(shortened.height).toBeGreaterThan(initial.height)
  await editor.page.keyboard.press('Escape')
  await editor.canvas.undo()
  expect((await expectAnchored()).width).toBe(initial.width)
  await editor.canvas.redo()
  expect((await expectAnchored()).width).toBe(shortened.width)
  editor.canvas.assertNoErrors()
})
