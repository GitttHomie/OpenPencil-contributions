import { expect, test } from '@playwright/test'

import { createRestoredLayoutScene } from '#tests/helpers/layout-sizing'
import { propertyField, propertySection } from '#tests/helpers/properties'

for (const sizing of ['Hug', 'Fill']) {
  for (const axis of ['width', 'height'] as const) {
    test(`typing ${axis} changes ${sizing} to Fixed and keeps decimals`, async ({ page }) => {
      const scene = await createRestoredLayoutScene(page)
      await propertySection(page, 'Layout')
        .getByRole('button', { name: 'Horizontal layout', exact: true })
        .click()
      const label = axis === 'width' ? 'Width' : 'Height'
      if (sizing === 'Fill') {
        await scene.select(scene.ids.child)
        await page.getByRole('combobox', { name: label, exact: true }).click()
        await page.getByRole('option', { name: 'Fill', exact: true }).click()
      }
      const before = await scene.read()
      const field = propertyField(page, axis)
      const select = page.getByRole('combobox', { name: label, exact: true })
      await expect(select).toContainText(sizing)
      await field.locator('[data-slot="value"]').click()
      await field.getByRole('spinbutton').press('Escape')
      await expect.poll(scene.read).toEqual(before)
      await expect(select).toContainText(sizing)
      await field.locator('[data-slot="value"]').click()
      const input = field.getByRole('spinbutton')
      await input.fill('170.5')
      await input.press('Enter')
      await expect(field).toContainText('170.5')
      await expect
        .poll(async () => (await scene.read())[sizing === 'Hug' ? 0 : 1][axis])
        .toBe(170.5)
      await select.click()
      await expect(page.getByRole('option', { name: 'Fixed', exact: true })).toHaveAttribute(
        'aria-selected',
        'true'
      )
      await page.keyboard.press('Escape')
      const after = await scene.read()
      await page.getByTestId('canvas-element').focus()
      await page.keyboard.press('Meta+z')
      await expect.poll(scene.read).toEqual(before)
      await expect(select).toContainText(sizing)
      await page.keyboard.press('Meta+Shift+z')
      await expect.poll(scene.read).toEqual(after)
      scene.canvas.assertNoErrors()
    })
  }
}
