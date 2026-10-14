import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { clickDepthDriver } from '#tests/helpers/canvas/click-depth/driver'

// Both plain and auto-layout frames follow the fork’s outer-first selection model.

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

const scene = clickDepthDriver(() => editor.page)

test('hovering and clicking the empty area of a top-level auto layout frame selects it', async () => {
  const { auto } = await scene.cards()
  await editor.canvas.waitForRender()
  const gap = await scene.at(auto, 100, 200)

  await editor.canvas.hover(gap.x, gap.y)
  await expect.poll(async () => (await scene.state()).hovered).toBe(auto)

  await editor.canvas.click(gap.x, gap.y)
  await expect.poll(async () => (await scene.state()).selected).toEqual([auto])
  editor.canvas.assertNoErrors()
})

test('a click selects the outer auto layout frame and the next click selects its child', async () => {
  const { auto } = await scene.cards()
  await editor.canvas.waitForRender()
  const button = await scene.at(auto, 100, 108)
  const [, buttonId] = await scene.children(auto)

  await editor.canvas.click(button.x, button.y)
  await expect.poll(async () => (await scene.state()).selected).toEqual([auto])
  await editor.canvas.click(button.x, button.y)
  await expect.poll(async () => (await scene.state()).selected).toEqual([buttonId])
  editor.canvas.assertNoErrors()
})

test('dragging the empty area of a top-level auto layout frame moves it', async () => {
  const { auto } = await scene.cards()
  await editor.canvas.waitForRender()
  const gap = await scene.at(auto, 100, 200)

  await editor.canvas.drag(gap.x, gap.y, gap.x + 60, gap.y + 40)
  await expect.poll(() => scene.position(auto)).toEqual({ x: 160, y: 140 })
  expect((await scene.state()).selected).toEqual([auto])
  editor.canvas.assertNoErrors()
})

test('the empty area of a plain top-level frame selects and moves the frame', async () => {
  const { plain } = await scene.cards()
  await editor.canvas.waitForRender()
  const gap = await scene.at(plain, 100, 200)

  await editor.canvas.hover(gap.x, gap.y)
  expect((await scene.state()).hovered).toBe(plain)

  await editor.canvas.click(gap.x, gap.y)
  expect((await scene.state()).selected).toEqual([plain])

  await editor.canvas.drag(gap.x, gap.y, gap.x + 60, gap.y + 40)
  expect(await scene.position(plain)).toEqual({ x: 460, y: 140 })
  editor.canvas.assertNoErrors()
})

test('repeated clicks at one point reach deeper layers, one level at a time', async () => {
  const ids = await scene.nestedBoard()
  await editor.canvas.waitForRender()
  const point = await scene.at(ids.label, 20, 20)

  for (const expected of [ids.board, ids.grid, ids.cell, ids.label]) {
    await editor.canvas.click(point.x, point.y)
    await expect.poll(async () => (await scene.state()).selected).toEqual([expected])
    // Exercise separate clicks as well as the rapid-click coverage in selection-depth.
    await editor.page.waitForTimeout(600)
  }
  editor.canvas.assertNoErrors()
})

test('holding Cmd hovers the deepest layer, the one a Cmd-click selects', async () => {
  const ids = await scene.nestedBoard()
  await editor.canvas.waitForRender()
  const point = await scene.at(ids.label, 20, 20)

  await editor.canvas.hover(point.x, point.y)
  await expect.poll(async () => (await scene.state()).hovered).toBe(ids.board)
  await editor.page.keyboard.down('Meta')
  await expect.poll(async () => (await scene.state()).hovered).toBe(ids.label)
  await editor.page.keyboard.up('Meta')
  await expect.poll(async () => (await scene.state()).hovered).toBe(ids.board)
  editor.canvas.assertNoErrors()
})
