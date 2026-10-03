import { readFile } from 'node:fs/promises'

import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { createPhotoCard, appendPhotoScrim } from '#tests/helpers/canvas/paint'
import { readScenePixels } from '#tests/helpers/canvas/pixels'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

test('the shared AI/MCP fill tool paints a gradient over an image on the same frame', async () => {
  const { page, canvas } = editor
  const id = await createPhotoCard(
    page,
    await readFile('tests/fixtures/vectorize/pilot_avatar.png')
  )
  const samples = [
    { x: 240, y: 100 },
    { x: 240, y: 380 }
  ]
  const brightness = (pixel: number[]) => pixel[0] + pixel[1] + pixel[2]
  await expect
    .poll(async () => brightness((await readScenePixels(page, [{ x: 180, y: 280 }]))[0]))
    .toBeLessThan(650)
  const before = await readScenePixels(page, samples)
  const result = await appendPhotoScrim(page, id)
  expect(result).toMatchObject({
    fill_index: 1,
    fills: [{ type: 'IMAGE' }, { type: 'GRADIENT_LINEAR' }]
  })
  const after = await readScenePixels(page, samples)
  expect(brightness(after[0])).toBeGreaterThan(brightness(before[0]) * 0.85)
  expect(brightness(after[1])).toBeLessThan(brightness(before[1]) * 0.6)
  await canvas.waitForRender()
  expect(await canvas.screenshotCanvasRegion(490, 550)).toMatchSnapshot(
    'photo-card-gradient-scrim.png'
  )
  canvas.assertNoErrors()
})
