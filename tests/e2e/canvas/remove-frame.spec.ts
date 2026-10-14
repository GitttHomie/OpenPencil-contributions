import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { seedSelectionDepth } from '#tests/helpers/canvas/selection-depth'

test('Remove frame frees its children from the context menu and the Ungroup shortcut', async ({
  page
}) => {
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  const ids = await seedSelectionDepth(page)
  await canvas.click(200, 220)
  await canvas.canvas.click({ position: { x: 200, y: 220 }, button: 'right' })
  await page.getByRole('menuitem', { name: /Remove frame/ }).click()
  const state = () =>
    page.evaluate((ids) => {
      const editor = window.openPencil?.getStore?.()
      if (!editor) throw new Error('Missing editor')
      return {
        exists: !!editor.graph.getNode(ids.parent),
        promoted: editor.graph.getNode(ids.badge)?.parentId === editor.state.currentPageId
      }
    }, ids)
  await expect.poll(state).toEqual({ exists: false, promoted: true })
  const mod = process.platform === 'darwin' ? 'Meta' : 'Control'
  await page.keyboard.press(`${mod}+z`)
  await expect.poll(state).toEqual({ exists: true, promoted: false })
  await page.keyboard.press(`${mod}+Shift+g`)
  await expect.poll(state).toEqual({ exists: false, promoted: true })
})
