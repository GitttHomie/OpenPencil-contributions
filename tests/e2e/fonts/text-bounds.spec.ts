import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { createTextBoundsFixture, readTextBounds } from '#tests/helpers/fonts/bounds'
import { selectTextForTypography } from '#tests/helpers/fonts/typography'
import { getNodeById } from '#tests/helpers/store'

test('auto-sized Inter Medium text and its Hug parent reflow when the face arrives', async ({
  page
}) => {
  let release: (() => void) | undefined
  const download = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/Inter-Medium.ttf', async (route) => {
    await download
    await route.continue()
  })
  try {
    await page.goto('/?test&no-chrome&no-rulers')
    const canvas = new CanvasHelper(page)
    await canvas.waitForInit()
    const ids = await createTextBoundsFixture(page)
    release?.()
    for (const id of [ids.text, ids.standalone]) {
      await expect
        .poll(async () => {
          const bounds = await readTextBounds(page, id)
          return (
            bounds.measured !== null &&
            bounds.width === bounds.measured.width &&
            bounds.height === bounds.measured.height
          )
        })
        .toBe(true)
    }
    const bounds = await readTextBounds(page, ids.text)
    const frame = await getNodeById(page, ids.frame)
    expect(frame?.width).toBe(bounds.width + 32)
    expect(frame?.height).toBe(bounds.height + 24)
    await canvas.undo()
    await canvas.redo()
    const restored = await readTextBounds(page, ids.standalone)
    expect(restored.width).toBe(restored.measured?.width)
    expect(restored.height).toBe(restored.measured?.height)
    await selectTextForTypography(page, ids.standalone)
    const selected = await readTextBounds(page, ids.standalone)
    expect(selected.selection).toHaveLength(1)
    const selection = selected.selection[0]
    expect(selected.width - selection.x - selection.width).toBeLessThan(1)
    expect(Math.abs(selected.height - selection.y - selection.height)).toBeLessThan(1)
    await canvas.waitForRender()
    expect(await canvas.screenshotCanvasRegion(350, 300)).toMatchSnapshot(
      'inter-medium-button-bounds.png'
    )
    canvas.assertNoErrors()
  } finally {
    release?.()
  }
})
