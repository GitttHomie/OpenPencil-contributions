import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { saveAndReopenPropertyDocument } from '#tests/helpers/components/property-authoring'
import {
  readDefaultVisibilityLayout,
  readVisibilityLayout,
  renderInstancesWithHiddenAction,
  seedDefaultVisibilityLayout,
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

test('changing a reopened component visibility default resizes inherited instances', async ({
  page
}, testInfo) => {
  await page.goto('/?test&no-rulers')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await seedDefaultVisibilityLayout(page)
  await saveAndReopenPropertyDocument(page, testInfo.outputPath('default-visibility.fig'))
  await readDefaultVisibilityLayout(page, true)
  const manager = propertySection(page, 'Component properties')
  await manager
    .getByRole('button', { name: 'Component properties: Show subtext', exact: true })
    .click()
  await manager.getByRole('switch', { name: 'Default value', exact: true }).click()
  const hidden = {
    mainHeight: 40,
    listHeight: 204,
    rows: [
      { height: 40, y: 0, visible: false },
      { height: 100, y: 52, visible: true },
      { height: 40, y: 164, visible: false }
    ]
  }
  await expect.poll(() => readDefaultVisibilityLayout(page)).toEqual(hidden)
  await page.getByTestId('canvas-element').focus()
  await canvas.undo()
  await expect
    .poll(() => readDefaultVisibilityLayout(page))
    .toEqual({
      mainHeight: 100,
      listHeight: 264,
      rows: [
        { height: 100, y: 0, visible: true },
        { height: 100, y: 112, visible: true },
        { height: 40, y: 224, visible: false }
      ]
    })
  await canvas.redo()
  await expect.poll(() => readDefaultVisibilityLayout(page)).toEqual(hidden)
  await readDefaultVisibilityLayout(page, true)
  await canvas.waitForRender()
  expect(await canvas.screenshotCanvasRegion(620, 350)).toMatchSnapshot(
    'component-default-visibility-layout.png'
  )
  canvas.assertNoErrors()
})

test('agent-created instances hug visible content without an inspector toggle', async ({
  page
}) => {
  await page.goto('/?test&no-chrome&no-rulers')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  expect(await renderInstancesWithHiddenAction(page)).toEqual({
    mainHeight: 100,
    listHeight: 92,
    rows: [
      { height: 40, y: 0 },
      { height: 40, y: 52 }
    ]
  })
  await canvas.waitForRender()
  canvas.assertNoErrors()
  expect(await canvas.screenshotCanvasRegion(620, 240)).toMatchSnapshot('hidden-action-layout.png')
})
