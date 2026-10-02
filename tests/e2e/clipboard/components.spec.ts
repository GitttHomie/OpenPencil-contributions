import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import {
  clipboardHTML,
  createComponentLabelScene,
  deliverClipboardPaste,
  readComponentPasteState,
  selectComponent
} from '#tests/helpers/component-labels'

test('copying a definition through the app pastes a linked sibling instance and undoes in one step', async ({
  page,
  context
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/?test&no-rulers')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  const nodes = await createComponentLabelScene(page)
  await selectComponent(page, nodes.component)
  await page.getByTestId('canvas-element').focus()
  const previousHTML = await clipboardHTML(page)
  await page.keyboard.press('Meta+c')
  await expect.poll(() => clipboardHTML(page)).not.toBe(previousHTML)
  await expect.poll(() => clipboardHTML(page)).not.toBe('')
  await deliverClipboardPaste(page, await clipboardHTML(page))
  const before = await readComponentPasteState(page, nodes.component)
  await expect
    .poll(() => readComponentPasteState(page, nodes.component))
    .toEqual({
      selected: { type: 'INSTANCE', componentId: nodes.component, parentId: before.pageId },
      originalChildren: [],
      definitionCount: 1,
      pageId: before.pageId
    })
  await page.keyboard.press('Meta+z')
  await expect
    .poll(async () => (await readComponentPasteState(page, nodes.component)).selected?.type)
    .toBe('COMPONENT')
  await page.keyboard.press('Meta+Shift+z')
  await expect
    .poll(async () => (await readComponentPasteState(page, nodes.component)).selected?.type)
    .toBe('INSTANCE')
  canvas.assertNoErrors()
})
