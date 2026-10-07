import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import {
  clipSelectionParent,
  moveSelectionSubtreeToPage,
  seedSelectionDepth,
  selectionDepthState,
  selectionNodePosition
} from '#tests/helpers/canvas/selection-depth'

for (const type of ['COMPONENT', 'INSTANCE'] as const) {
  test(`${type}: descendant indicators inherit purple and reset outside the component`, async ({
    page
  }) => {
    await page.goto('/?test&no-rulers')
    const canvas = new CanvasHelper(page)
    await canvas.waitForInit()
    await canvas.clearCanvas()
    const ids = await seedSelectionDepth(page, type)
    await page.keyboard.down('Meta')
    await canvas.click(285, 140)
    await page.keyboard.up('Meta')
    await expect.poll(() => selectionDepthState(page)).toMatchObject({ selected: [ids.text] })
    const row = page.locator(`[data-node-id="${ids.text}"] [data-slot="row"]`)
    await expect(row.locator('[data-slot="label"]')).toHaveCSS('color', 'rgb(151, 71, 255)')
    await expect(row.locator('[data-slot="icon"]')).toHaveCSS('color', 'rgb(151, 71, 255)')
    await page.mouse.move(10, 10)
    await canvas.waitForRender()
    expect(await canvas.screenshotCanvasRegion(500, 330)).toMatchSnapshot(
      `${type.toLowerCase()}-descendant-selection.png`
    )
    await moveSelectionSubtreeToPage(page, ids.wrapper)
    await expect(row.locator('[data-slot="label"]')).not.toHaveCSS('color', 'rgb(151, 71, 255)')
    canvas.assertNoErrors()
  })
}

for (const type of ['FRAME', 'GROUP', 'COMPONENT', 'INSTANCE'] as const) {
  test(`${type}: overflow selects its parent and single clicks drill one level to editable text`, async ({
    page
  }) => {
    await page.goto('/?test&no-rulers')
    const canvas = new CanvasHelper(page)
    await canvas.waitForInit()
    await canvas.clearCanvas()
    const ids = await seedSelectionDepth(page, type)
    await canvas.click(285, 140)
    await expect
      .poll(() => selectionDepthState(page))
      .toMatchObject({
        selected: [ids.parent],
        editing: null
      })
    await canvas.click(285, 140)
    await expect
      .poll(() => selectionDepthState(page))
      .toMatchObject({
        selected: [ids.badge],
        entered: ids.parent,
        editing: null
      })
    await canvas.click(285, 140)
    await expect
      .poll(() => selectionDepthState(page))
      .toMatchObject({
        selected: [ids.wrapper],
        entered: ids.badge,
        editing: null
      })
    await canvas.click(285, 140)
    await expect
      .poll(() => selectionDepthState(page))
      .toMatchObject({
        selected: [ids.text],
        entered: ids.wrapper,
        editing: null
      })
    await canvas.click(285, 140)
    await expect.poll(() => selectionDepthState(page)).toMatchObject({ editing: null })
    await canvas.dblclick(285, 140)
    await expect.poll(() => selectionDepthState(page)).toMatchObject({ editing: ids.text })
  })
}

test('Cmd-click selects the deepest overflow descendant; clipping makes it unclickable', async ({
  page
}) => {
  await page.goto('/?test&no-rulers')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await canvas.clearCanvas()
  const ids = await seedSelectionDepth(page)
  const other = await seedSelectionDepth(page, 'FRAME', 300)
  await page.keyboard.down('Meta')
  await canvas.click(285, 140)
  await page.keyboard.up('Meta')
  await expect
    .poll(() => selectionDepthState(page))
    .toMatchObject({
      selected: [ids.text],
      editing: null
    })
  await page.keyboard.down('Meta')
  await canvas.dblclick(285, 140)
  await page.keyboard.up('Meta')
  await expect
    .poll(() => selectionDepthState(page))
    .toMatchObject({
      selected: [ids.text],
      editing: null
    })
  await canvas.click(585, 140)
  await expect.poll(() => selectionDepthState(page)).toMatchObject({ selected: [other.parent] })
  await page.keyboard.down('Meta')
  await canvas.click(285, 140)
  await page.keyboard.up('Meta')
  await canvas.dblclick(285, 140)
  await expect.poll(() => selectionDepthState(page)).toMatchObject({ editing: ids.text })
  await page.keyboard.down('Meta')
  await canvas.click(585, 140)
  await page.keyboard.up('Meta')
  await expect
    .poll(() => selectionDepthState(page))
    .toMatchObject({
      selected: [other.text],
      editing: null
    })
  await clipSelectionParent(page, ids.parent)
  await page.keyboard.down('Meta')
  await canvas.click(285, 140)
  await page.keyboard.up('Meta')
  await expect.poll(() => selectionDepthState(page)).toMatchObject({ selected: [], editing: null })
})

test('rapid clicks select one level per click without an extra double-click drill', async ({
  page
}) => {
  await page.goto('/?test&no-rulers')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await canvas.clearCanvas()
  const ids = await seedSelectionDepth(page)
  await canvas.dblclick(285, 140)
  await expect
    .poll(() => selectionDepthState(page))
    .toMatchObject({
      selected: [ids.badge],
      entered: ids.parent,
      editing: null
    })
  await canvas.dblclick(285, 140)
  await expect
    .poll(() => selectionDepthState(page))
    .toMatchObject({
      selected: [ids.text],
      entered: ids.wrapper,
      editing: null
    })
})

test('dragging over a selected parent’s child keeps moving the parent', async ({ page }) => {
  await page.goto('/?test&no-rulers')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await canvas.clearCanvas()
  const ids = await seedSelectionDepth(page)
  await canvas.click(285, 140)
  await canvas.drag(285, 140, 315, 160)
  await expect.poll(() => selectionNodePosition(page, ids.parent)).toEqual({ x: 130, y: 200 })
  await expect.poll(() => selectionNodePosition(page, ids.badge)).toEqual({ x: 150, y: -70 })
  await expect
    .poll(() => selectionDepthState(page))
    .toMatchObject({
      selected: [ids.parent],
      entered: null,
      editing: null
    })
})

test('dragging an overflowing badge moves its outer parent and Shift-click adds another parent', async ({
  page
}) => {
  await page.goto('/?test&no-rulers')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await canvas.clearCanvas()
  const first = await seedSelectionDepth(page)
  const second = await seedSelectionDepth(page, 'FRAME', 300)
  await canvas.drag(285, 140, 315, 160)
  await expect.poll(() => selectionNodePosition(page, first.parent)).toEqual({ x: 130, y: 200 })
  await expect.poll(() => selectionNodePosition(page, first.badge)).toEqual({ x: 150, y: -70 })
  await page.keyboard.down('Shift')
  await canvas.click(585, 140)
  await page.keyboard.up('Shift')
  await expect
    .poll(() => selectionDepthState(page))
    .toMatchObject({
      selected: expect.arrayContaining([first.parent, second.parent]),
      editing: null
    })
})

test('overlapping overflow selects the frontmost outer parent', async ({ page }) => {
  await page.goto('/?test&no-rulers')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await canvas.clearCanvas()
  await seedSelectionDepth(page)
  const front = await seedSelectionDepth(page)
  await canvas.click(285, 140)
  await expect.poll(() => selectionDepthState(page)).toMatchObject({ selected: [front.parent] })
})
