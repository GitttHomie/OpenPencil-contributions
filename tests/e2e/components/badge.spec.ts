import { expect, test } from '@playwright/test'

import { expectDefined } from '#tests/helpers/assert'
import { createComponentBadgeScene } from '#tests/helpers/components/badge'
import { propertyField, propertySection } from '#tests/helpers/properties'

test('a pasted instance follows badge and text edits; deleting its badge hides it with undo', async ({
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
  await expect
    .poll(async () => (await scene.read())[1].badge)
    .toMatchObject({
      x: 100,
      y: -12,
      layoutPositioning: 'ABSOLUTE'
    })
  await scene.addNumber(badgeId)
  for (const direction of ['horizontally', 'vertically']) {
    await propertySection(page, 'Position')
      .getByRole('button', { name: `Align center ${direction}`, exact: true })
      .click()
  }
  await expect
    .poll(async () => {
      const [component, instance] = await scene.read()
      return instance.text?.x === component.text?.x && instance.text?.y === component.text?.y
    })
    .toBe(true)
  const width = propertyField(page, 'width')
  await width.dblclick()
  await width.getByRole('spinbutton').fill('32')
  await width.getByRole('spinbutton').press('Enter')
  await propertySection(page, 'Position')
    .getByRole('button', { name: 'Align center horizontally', exact: true })
    .click()
  await propertySection(page, 'Typography')
    .getByRole('button', { name: 'Align center horizontally', exact: true })
    .click()
  await page.getByRole('combobox', { name: 'Font weight', exact: true }).click()
  await page.getByRole('option', { name: 'Bold', exact: true }).click()
  await expect
    .poll(async () => (await scene.read())[1].text)
    .toMatchObject({
      x: 0,
      width: 32,
      fontWeight: 700,
      textAutoResize: 'HEIGHT',
      textAlignHorizontal: 'CENTER'
    })
  const [component, instance] = await scene.read()
  expect(instance.text).toEqual(component.text)
  await page.getByRole('button', { name: 'Fixed size', exact: true }).click()
  const fixed = expectDefined((await scene.read())[0].text, 'fixed text')
  await page.getByRole('combobox', { name: 'Font weight', exact: true }).click()
  await page.getByRole('option', { name: 'Regular', exact: true }).click()
  await expect
    .poll(async () => (await scene.read())[1].text)
    .toMatchObject({
      width: fixed.width,
      height: fixed.height,
      textAutoResize: 'NONE',
      fontWeight: 400
    })
  await page.getByTestId('canvas-element').focus()
  await page.keyboard.press('Escape')
  await scene.canvas.waitForRender()
  expect(await scene.canvas.screenshotCanvasRegion(720, 330)).toMatchSnapshot(
    'component-and-instance-badge.png'
  )

  const instanceBadge = expectDefined(instance.badge, 'instance badge')
  await scene.select(instanceBadge.id)
  await page.getByTestId('canvas-element').focus()
  await page.keyboard.press('Backspace')
  await expect
    .poll(async () => (await scene.read())[1].badge)
    .toMatchObject({
      id: instanceBadge.id,
      visible: false
    })
  expect((await scene.read())[0].badge?.visible).toBe(true)
  await scene.canvas.undo()
  await expect.poll(async () => (await scene.read())[1].badge?.visible).toBe(true)
  await scene.canvas.redo()
  await expect.poll(async () => (await scene.read())[1].badge?.visible).toBe(false)
  scene.canvas.assertNoErrors()
})
