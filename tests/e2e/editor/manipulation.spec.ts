import { expect, test } from '@playwright/test'

import { createManipulationScene } from '#tests/helpers/manipulation'

test.use({ viewport: { width: 1500, height: 1000 } })

for (const layout of [false, true]) {
  test(`drag child out of ${layout ? 'auto-layout' : 'free-positioned'} frame and undo`, async ({
    page
  }) => {
    const scene = await createManipulationScene(page, layout)
    await scene.drag(240, 130, 240, 360)
    let state = await scene.read()
    expect(state.nodes.find((node) => node.id === scene.ids.children[1])).toMatchObject({
      parentId: scene.ids.page,
      x: 200,
      y: 330
    })
    await page.keyboard.press('Meta+z')
    state = await scene.read()
    expect(state.nodes.find((node) => node.id === scene.ids.frame)?.childIds).toEqual(
      scene.ids.children
    )
    expect(state.nodes.find((node) => node.id === scene.ids.children[1])).toMatchObject({
      parentId: scene.ids.frame,
      x: 120,
      y: 20
    })
    scene.canvas.assertNoErrors()
  })
}

test('drag between frames nests without changing the visual drop position', async ({ page }) => {
  const scene = await createManipulationScene(page)
  await scene.drag(240, 130, 560, 170)
  const state = await scene.read()
  expect(state.nodes.find((node) => node.id === scene.ids.children[1])).toMatchObject({
    parentId: scene.ids.target,
    x: 40,
    y: 60
  })
  await page.keyboard.press('Meta+z')
  expect((await scene.read()).nodes.find((node) => node.id === scene.ids.frame)?.childIds).toEqual(
    scene.ids.children
  )
  scene.canvas.assertNoErrors()
})

test('Frame tool draws a nested child and creation remains a single undo step', async ({
  page
}) => {
  const scene = await createManipulationScene(page)
  await page.keyboard.press('f')
  await scene.drag(500, 110, 640, 230)
  let state = await scene.read()
  const child = state.nodes.find((node) => state.selected.includes(node.id))
  expect(child).toMatchObject({ parentId: scene.ids.target, x: 20, y: 30, width: 140, height: 120 })
  await page.keyboard.press('Meta+z')
  state = await scene.read()
  expect(state.nodes.some((node) => node.id === child?.id)).toBe(false)
  expect(state.canUndo).toBe(false)
  await page.keyboard.press('Meta+Shift+z')
  expect((await scene.read()).nodes.find((node) => node.id === child?.id)).toMatchObject({
    parentId: scene.ids.target,
    x: 20,
    y: 30
  })
  scene.canvas.assertNoErrors()
})

test('arrow keys reorder layout children and immediate Undo restores order', async ({ page }) => {
  const scene = await createManipulationScene(page, true)
  await page.getByTestId('canvas-element').focus()
  await page.keyboard.press('ArrowRight')
  let state = await scene.read()
  const [a, b, c] = scene.ids.children
  expect(state.nodes.find((node) => node.id === scene.ids.frame)?.childIds).toEqual([a, c, b])
  await page.keyboard.press('Meta+z')
  state = await scene.read()
  expect(state.nodes.find((node) => node.id === scene.ids.frame)?.childIds).toEqual([a, b, c])
  scene.canvas.assertNoErrors()
})

test('Escape cancels a held drag without moving or deselecting the object', async ({ page }) => {
  const scene = await createManipulationScene(page, true)
  const from = scene.point(240, 130)
  const to = scene.point(240, 360)
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 10 })
  await page.keyboard.press('Escape')
  await page.mouse.up()
  const state = await scene.read()
  expect(state.nodes.find((node) => node.id === scene.ids.children[1])).toMatchObject({
    parentId: scene.ids.frame,
    x: 120,
    y: 20
  })
  expect(state.selected).toEqual([scene.ids.children[1]])
  expect(state.canUndo).toBe(false)
  scene.canvas.assertNoErrors()
})

test('multiple selected children drag as an ordered block', async ({ page }) => {
  const scene = await createManipulationScene(page, true)
  const [a, b, c] = scene.ids.children
  await scene.select([b, a])
  await scene.drag(240, 130, 420, 130)
  expect((await scene.read()).nodes.find((node) => node.id === scene.ids.frame)?.childIds).toEqual([
    c,
    a,
    b
  ])
  await page.keyboard.press('Meta+z')
  expect((await scene.read()).nodes.find((node) => node.id === scene.ids.frame)?.childIds).toEqual([
    a,
    b,
    c
  ])
  scene.canvas.assertNoErrors()
})
