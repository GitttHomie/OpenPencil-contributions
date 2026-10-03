import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

for (const theme of ['light', 'dark']) {
  test(`typography groups remain directly editable in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1200 })
    await page.goto('/?test')
    await new CanvasHelper(page).waitForInit()
    await page.getByTestId('app-settings-trigger').click()
    await page.getByTestId('settings-section-general').click()
    await page.getByRole('combobox', { name: 'Theme', exact: true }).click()
    await page
      .getByRole('option', { name: theme === 'light' ? 'Light' : 'Dark', exact: true })
      .click()
    await page.getByTestId('app-settings-done').click()
    await expect(page.getByTestId('app-settings-dialog')).toHaveCount(0)
    const id = await page.evaluate(() => {
      const editor = window.openPencil?.getStore?.()
      if (!editor) throw new Error('Editor unavailable')
      const id = editor.createShape('TEXT', 100, 100, 240, 80)
      editor.updateNode(id, { text: 'Typography review', fontSize: 24 })
      editor.select([id])
      return id
    })
    const section = page.getByRole('region', { name: 'Typography', exact: true })
    await expect(section.locator('[data-property="letterSpacing"]')).toContainText('px')
    await expect(section.locator('[data-property="lineHeight"]')).toContainText('Auto')
    await expect(section).toHaveScreenshot(`typography-groups-${theme}.png`)
    await section.getByRole('button', { name: 'Align center horizontally', exact: true }).click()
    await expect
      .poll(() =>
        page.evaluate(
          (id) => window.openPencil?.getStore?.().graph.getNode(id)?.textAlignHorizontal,
          id
        )
      )
      .toBe('CENTER')
    await section.getByRole('switch', { name: 'Standard ligatures', exact: true }).click()
    await expect
      .poll(() =>
        page.evaluate(
          (id) =>
            window.openPencil
              ?.getStore?.()
              .graph.getNode(id)
              ?.fontFeatures.find((feature) => feature.tag === 'LIGA')?.enabled,
          id
        )
      )
      .toBe(false)
  })
}
