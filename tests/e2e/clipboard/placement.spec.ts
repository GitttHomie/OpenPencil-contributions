import { expect, test } from '@playwright/test'

import { createClipboardPlacementScene } from '#tests/helpers/clipboard-placement'

test('paste event centers inside the selected nested frame regardless of the last mouse position', async ({
  page
}) => {
  const scene = await createClipboardPlacementScene(page)
  const canvas = page.getByTestId('canvas-element')
  await canvas.focus()
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Canvas unavailable')
  await page.mouse.move(box.x + 650, box.y + 500)
  await scene.paste()
  await expect
    .poll(scene.read)
    .toEqual([
      expect.objectContaining({
        x: 110,
        y: 80,
        width: 80,
        height: 60,
        children: [{ x: 7, y: 11, width: 30, height: 20 }]
      })
    ])
  const after = await scene.read()
  await page.mouse.move(10, 10)
  await scene.canvas.waitForRender()
  expect(await scene.canvas.screenshotCanvasRegion(650, 500)).toMatchSnapshot(
    'paste-centered-in-nested-frame.png'
  )
  await page.keyboard.press('Meta+z')
  await expect.poll(scene.read).toEqual([])
  await page.keyboard.press('Meta+Shift+z')
  await expect.poll(scene.read).toEqual(after)
  scene.canvas.assertNoErrors()
})
