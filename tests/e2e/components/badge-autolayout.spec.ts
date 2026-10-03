import { expect, test } from '@playwright/test'

import { expectDefined } from '#tests/helpers/assert'
import { createComponentBadgeScene } from '#tests/helpers/components/badge'
import { propertyField } from '#tests/helpers/properties'

test('typing a badge number before enabling auto layout in the panel keeps one instance text', async ({
  page
}) => {
  const scene = await createComponentBadgeScene(page)
  const badgeId = await scene.pasteAndAddBadge()
  await page.getByRole('switch', { name: 'Exclude from auto layout' }).click()
  for (const [axis, value] of [
    ['x', '100'],
    ['y', '(-12)']
  ]) {
    const field = propertyField(page, axis)
    await field.dblclick()
    await field.getByRole('spinbutton').fill(value)
    await field.getByRole('spinbutton').press('Enter')
  }
  await page.getByTestId('canvas-element').focus()
  await scene.canvas.selectTool('text')
  await scene.canvas.click(249, 141)
  await expect(page.locator('textarea[aria-hidden="true"]')).toBeFocused()
  await page.keyboard.insertText('1')
  await page.keyboard.press('Escape')
  await expect
    .poll(async () =>
      (await scene.readBadgeContents(badgeId)).map((badge) =>
        badge.children.map((child) => ({ type: child.type, text: child.text }))
      )
    )
    .toEqual([[{ type: 'TEXT', text: '1' }], [{ type: 'TEXT', text: '1' }]])
  const initial = await scene.readBadgeContents(badgeId)
  await scene.select(badgeId)
  await page.getByRole('button', { name: 'Add auto layout', exact: true }).click()
  const laidOut = initial.map((badge) => ({ ...badge, layoutMode: 'VERTICAL' }))
  await expect.poll(() => scene.readBadgeContents(badgeId)).toEqual(laidOut)
  await page.getByTestId('canvas-element').focus()
  await scene.canvas.undo()
  await expect.poll(() => scene.readBadgeContents(badgeId)).toEqual(initial)
  await scene.canvas.redo()
  await expect.poll(() => scene.readBadgeContents(badgeId)).toEqual(laidOut)
  scene.canvas.assertNoErrors()
})

test('badge auto layout and wrapping its number keep one instance text through undo and redo', async ({
  page
}) => {
  const scene = await createComponentBadgeScene(page)
  const badgeId = await scene.pasteAndAddBadge()
  await page.getByRole('switch', { name: 'Exclude from auto layout' }).click()
  for (const [axis, value] of [
    ['x', '100'],
    ['y', '(-12)']
  ]) {
    const field = propertyField(page, axis)
    await field.dblclick()
    await field.getByRole('spinbutton').fill(value)
    await field.getByRole('spinbutton').press('Enter')
  }
  const numberId = await scene.addNumber(badgeId)
  const initial = await scene.readBadgeContents(badgeId)
  const numberCopy = expectDefined(initial[1].children[0], 'instance number')
  await scene.select(badgeId)
  await page.getByRole('button', { name: 'Add auto layout', exact: true }).click()
  await expect
    .poll(async () =>
      (await scene.readBadgeContents(badgeId)).map((badge) => ({
        layoutMode: badge.layoutMode,
        text: badge.children.map((child) => child.text)
      }))
    )
    .toEqual([
      { layoutMode: 'VERTICAL', text: ['1'] },
      { layoutMode: 'VERTICAL', text: ['1'] }
    ])
  await page.getByTestId('canvas-element').focus()
  await scene.canvas.undo()
  await expect.poll(() => scene.readBadgeContents(badgeId)).toEqual(initial)
  await scene.canvas.redo()
  await expect
    .poll(async () => (await scene.readBadgeContents(badgeId))[1].layoutMode)
    .toBe('VERTICAL')
  for (const axis of ['width', 'height']) {
    const field = propertyField(page, axis)
    await field.dblclick()
    await field.getByRole('spinbutton').fill('32')
    await field.getByRole('spinbutton').press('Enter')
  }
  await page
    .getByRole('button', {
      name: 'Align center vertically, Align center horizontally',
      exact: true
    })
    .click()
  await scene.select(numberId)
  await page.getByTestId('canvas-element').focus()
  await page.keyboard.press('Shift+a')
  const assertWrapped = async () => {
    await expect
      .poll(async () => (await scene.readBadgeContents(badgeId))[1].children)
      .toEqual([
        expect.objectContaining({ type: 'FRAME' }),
        expect.objectContaining({ id: numberCopy.id, type: 'TEXT', text: '1' })
      ])
  }
  await assertWrapped()
  await scene.canvas.undo()
  await expect
    .poll(async () => (await scene.readBadgeContents(badgeId))[1].children)
    .toEqual([numberCopy])
  await scene.canvas.redo()
  await assertWrapped()
  await page.keyboard.press('Escape')
  await scene.canvas.waitForRender()
  expect(await scene.canvas.screenshotCanvasRegion(720, 330)).toMatchSnapshot(
    'badge-autolayout-single-number.png',
    { maxDiffPixels: 0 }
  )
  scene.canvas.assertNoErrors()
})
