import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { internalPageState, seedInternalComponents } from '#tests/helpers/pages/internal-components'

test('empty and resource-only internal pages stay hidden while ordinary empty pages remain listed', async ({
  page
}) => {
  await page.goto('/?test&no-rulers')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  const internalId = await page.evaluate(() => {
    const store = window.openPencil.getStore()
    const empty = store.graph.addPage('Empty internal')
    const resources = store.graph.addPage('Internal resources')
    store.graph.updateNode(empty.id, { internalOnly: true })
    store.graph.updateNode(resources.id, { internalOnly: true })
    store.graph.createNode('TEXT', resources.id, {
      name: 'Heading style',
      internalOnly: true,
      sharedStyleType: 'TEXT'
    })
    store.graph.addPage('Empty design page')
    store.requestRender()
    return resources.id
  })
  const pages = page.getByTestId('pages-panel')
  await expect(pages.getByRole('button', { name: 'Empty internal', exact: true })).toHaveCount(0)
  await expect(pages.getByRole('button', { name: 'Internal resources', exact: true })).toHaveCount(
    0
  )
  await expect(pages.getByRole('button', { name: 'Empty design page', exact: true })).toBeVisible()
  await page.evaluate((id) => {
    const store = window.openPencil.getStore()
    store.graph.createNode('COMPONENT', id, { name: 'Embedded Button' })
    store.requestRender()
  }, internalId)
  await expect(pages.getByRole('button', { name: 'Internal resources', exact: true })).toBeVisible()
})

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
