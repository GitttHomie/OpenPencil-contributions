import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { internalPageState, seedInternalComponents } from '#tests/helpers/pages/internal-components'

test('embedded definitions remain internal but their page is reachable from Pages and Go to main component', async ({
  page
}) => {
  await page.goto('/?test&no-rulers')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await canvas.clearCanvas()
  const ids = await seedInternalComponents(page)
  const pages = page.getByTestId('pages-panel')
  const internal = pages.getByRole('button', { name: 'Imported library components', exact: true })
  await expect(internal).toBeVisible()
  await page.getByRole('button', { name: 'Go to main component', exact: true }).click()
  await expect
    .poll(() => internalPageState(page))
    .toMatchObject({ page: ids.internal, selected: [ids.component] })
  await pages.getByRole('button', { name: 'Page 1', exact: true }).click()
  await expect.poll(() => internalPageState(page)).toMatchObject({ page: ids.visiblePage })
  await internal.click()
  await expect
    .poll(() => internalPageState(page))
    .toMatchObject({ page: ids.internal, internal: [ids.internal], regular: [ids.visiblePage] })
  await internal.click({ button: 'right' })
  await expect(page.getByTestId('pages-context-delete')).toBeDisabled()
  await page.keyboard.press('Escape')
  canvas.assertNoErrors()
})
