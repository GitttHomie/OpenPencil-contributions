import { expect, test } from '@playwright/test'

import { createRestoredLayoutScene } from '#tests/helpers/layout-sizing'
import { propertySection } from '#tests/helpers/properties'

for (const direction of ['Horizontal', 'Vertical']) {
  test(`${direction}: restored constrained children enter flow and Fill cannot collapse the parent`, async ({
    page
  }) => {
    const scene = await createRestoredLayoutScene(page)
    const original = await scene.read()
    await propertySection(page, 'Layout')
      .getByRole('button', { name: `${direction} layout`, exact: true })
      .click()
    await expect
      .poll(async () =>
        (await scene.read()).map(({ x, y, width, height }) => ({ x, y, width, height }))
      )
      .toEqual([
        { x: 80, y: 90, width: 140, height: 90 },
        { x: 0, y: 0, width: 140, height: 90 }
      ])
    const flow = await scene.read()
    await scene.select(scene.ids.child)
    await expect(propertySection(page, 'Constraints')).toBeHidden()
    for (const axis of ['Width', 'Height']) {
      await page.getByRole('combobox', { name: axis, exact: true }).click()
      await page.getByRole('option', { name: 'Fill', exact: true }).click()
      await expect(page.getByRole('combobox', { name: axis, exact: true })).toContainText('Fill')
    }
    const fill = await scene.read()
    expect(fill[0]).toMatchObject({
      width: 140,
      height: 90,
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED'
    })
    expect(fill[1]).toMatchObject({ x: 0, y: 0, width: 140, height: 90 })
    await page.mouse.move(10, 10)
    await scene.canvas.waitForRender()
    expect(await scene.canvas.screenshotCanvasRegion(650, 500)).toMatchSnapshot(
      `restored-${direction.toLowerCase()}-fill.png`
    )
    await page.getByTestId('canvas-element').focus()
    await page.keyboard.press('Meta+z')
    await page.keyboard.press('Meta+z')
    await expect.poll(scene.read).toEqual(flow)
    await page.keyboard.press('Meta+z')
    await expect.poll(scene.read).toEqual(original)
    await expect(propertySection(page, 'Constraints')).toBeVisible()
  })
}
