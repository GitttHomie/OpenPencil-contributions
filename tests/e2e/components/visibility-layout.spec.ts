import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { saveAndReopenPropertyDocument } from '#tests/helpers/components/property-authoring'
import {
  readVisibilityLayout,
  seedVisibilityLayout
} from '#tests/helpers/components/visibility-layout'
import { propertySection } from '#tests/helpers/properties'

test('a reopened instance redistributes Fill space when its visibility property changes', async ({
  page
}, testInfo) => {
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await seedVisibilityLayout(page)
  await saveAndReopenPropertyDocument(page, testInfo.outputPath('visibility.fig'))
  await readVisibilityLayout(page, true)
  const visible = propertySection(page, 'Component properties').getByRole('switch', {
    name: 'Show fixed',
    exact: true
  })
  await expect(visible).toBeChecked()
  await visible.click()
  await expect
    .poll(() => readVisibilityLayout(page))
    .toEqual({
      visible: false,
      x: 0,
      width: 300,
      innerWidth: 300
    })
  await page.getByTestId('canvas-element').focus()
  await canvas.undo()
  await expect
    .poll(() => readVisibilityLayout(page))
    .toEqual({
      visible: true,
      x: 90,
      width: 210,
      innerWidth: 210
    })
  await canvas.redo()
  await expect
    .poll(() => readVisibilityLayout(page))
    .toEqual({
      visible: false,
      x: 0,
      width: 300,
      innerWidth: 300
    })
  canvas.assertNoErrors()
})
