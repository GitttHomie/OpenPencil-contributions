import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { pixelGridDriver } from '#tests/helpers/canvas/pixel/grid-driver'

// The fork starts the pixel grid at 400% on every display.

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

const grid = pixelGridDriver(() => editor.page)

async function zoomTo(zoom: number) {
  await grid.showAtZoom(zoom)
  await editor.canvas.waitForRender()
}

test('the pixel grid shows when zoomed in and Shift+quote toggles it', async () => {
  await zoomTo(8)
  const shown = await editor.canvas.screenshotCanvasRegion(480, 320)
  expect(shown).toMatchSnapshot('pixel-grid-800.png', { maxDiffPixelRatio: 0, threshold: 0 })

  await editor.page.keyboard.press('Shift+Quote')
  await editor.canvas.waitForRender()
  expect(await editor.canvas.screenshotCanvasRegion(480, 320)).not.toEqual(shown)

  await editor.page.keyboard.press('Shift+Quote')
  await editor.canvas.waitForRender()
  expect(await editor.canvas.screenshotCanvasRegion(480, 320)).toEqual(shown)
  editor.canvas.assertNoErrors()
})

test('below 400% zoom the canvas has no grid', async () => {
  await zoomTo(3.99)
  const before = await editor.canvas.screenshotCanvasRegion(480, 320)
  await editor.page.keyboard.press('Shift+Quote')
  await editor.canvas.waitForRender()
  expect(await editor.canvas.screenshotCanvasRegion(480, 320)).toEqual(before)
  await editor.page.keyboard.press('Shift+Quote')
})

test('Shift+Cmd+quote toggles snapping to the pixel grid', async () => {
  await zoomTo(1)
  expect(await grid.snapsToPixelGrid()).toBe(true)
  await editor.page.keyboard.press('ControlOrMeta+Shift+Quote')
  await expect.poll(() => grid.snapsToPixelGrid()).toBe(false)
  await editor.page.keyboard.press('ControlOrMeta+Shift+Quote')
  await expect.poll(() => grid.snapsToPixelGrid()).toBe(true)
})
