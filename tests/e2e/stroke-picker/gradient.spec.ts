import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import {
  beginGradientDrag,
  createGradientFixture,
  gradientPointOnScreen
} from '#tests/helpers/canvas/gradient'
import { propertyItems, propertySection } from '#tests/helpers/properties'

async function selectedStroke(page: Page) {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const id = [...store.state.selectedIds][0]
    return store.graph.getNode(id)?.strokes?.[0] ?? null
  })
}

/** Until the stroke panel opened the fill picker, a stroke could only ever be one flat color. */
test('a stroke can be made a gradient and taken back to solid', async ({ page }) => {
  const canvas = new CanvasHelper(page)
  await page.goto('/')
  await canvas.waitForInit()

  await canvas.drawRect(120, 120, 180, 120)
  await propertySection(page, 'Stroke').getByRole('button', { name: 'Add stroke' }).click()
  await canvas.waitForRender()
  expect(await selectedStroke(page)).toMatchObject({ type: 'SOLID' })

  await propertyItems(page, 'strokes')
    .first()
    .getByRole('button', { name: 'Stroke', exact: true })
    .click()
  await expect(page.getByTestId('fill-picker-tab-gradient')).toBeVisible()

  await page.getByTestId('fill-picker-tab-gradient').click()
  await canvas.waitForRender()

  const gradient = await selectedStroke(page)
  expect(gradient?.type).toBe('GRADIENT_LINEAR')
  expect(gradient?.gradientStops?.length).toBeGreaterThan(1)
  // The stroke keeps its geometry across the paint change.
  expect(gradient).toMatchObject({ weight: 1, align: 'INSIDE' })

  await page.getByTestId('fill-picker-tab-solid').click()
  await canvas.waitForRender()

  // Switching back keeps the stops, as it does for a fill, so the gradient returns on re-pick.
  const solid = await selectedStroke(page)
  expect(solid?.type).toBe('SOLID')
  expect(solid).toMatchObject({ weight: 1, align: 'INSIDE' })
  canvas.assertNoErrors()
})

for (const type of [
  'GRADIENT_LINEAR',
  'GRADIENT_RADIAL',
  'GRADIENT_ANGULAR',
  'GRADIENT_DIAMOND'
] as const) {
  test(`${type} stroke uses canvas handles with snapping, cancellation, and undo`, async ({
    page
  }) => {
    const canvas = new CanvasHelper(page)
    await page.goto('/?test&no-rulers')
    await canvas.waitForInit()
    const fixture = await createGradientFixture(page, type, type === 'GRADIENT_LINEAR')
    await page.evaluate((id) => {
      const editor = window.openPencil?.getStore?.()
      const node = editor?.graph.getNode(id)
      if (!editor || !node) throw new Error('Missing gradient frame')
      editor.updateNode(id, {
        strokes: [{ ...structuredClone(node.fills[0]), weight: 12, align: 'INSIDE' }]
      })
    }, fixture.id)
    const before = await selectedStroke(page)
    await propertyItems(page, 'strokes')
      .first()
      .getByRole('button', { name: 'Stroke', exact: true })
      .click()
    const handle = page.getByRole('button', {
      name: type === 'GRADIENT_LINEAR' ? 'Gradient start' : 'Rotate and resize gradient',
      exact: true
    })
    await expect(handle).toBeVisible()
    await beginGradientDrag(
      page,
      handle,
      await gradientPointOnScreen(page, fixture.id, { x: 2, y: 3 })
    )
    await expect(page.locator('[data-gradient-snap-guide]')).toHaveCount(2)
    await page.mouse.up()
    const changed = await selectedStroke(page)
    expect(changed?.gradientTransform).not.toEqual(before?.gradientTransform)
    expect(changed).toMatchObject({ weight: 12, align: 'INSIDE' })
    await expect(page.locator('[data-picker-content]')).toBeVisible()
    const fill = await page.evaluate(
      (id) => window.openPencil?.getStore?.().graph.getNode(id)?.fills[0],
      fixture.id
    )
    expect(fill).toEqual(fixture.fill)
    await page.keyboard.press('Meta+z')
    await expect.poll(() => selectedStroke(page)).toEqual(before)
    await beginGradientDrag(
      page,
      handle,
      await gradientPointOnScreen(page, fixture.id, { x: 170, y: 130 })
    )
    await page.keyboard.press('Escape')
    await page.mouse.up()
    await expect.poll(() => selectedStroke(page)).toEqual(before)
    await page.screenshot({
      path: test.info().outputPath(`${type.toLowerCase()}-stroke-handles.png`)
    })
    await page.keyboard.press('Escape')
    await expect(handle).toHaveCount(0)
    canvas.assertNoErrors()
  })
}
