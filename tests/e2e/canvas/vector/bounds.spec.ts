import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import type * as BoundsFixture from '#tests/helpers/canvas/vector-bounds'

test.use({ viewport: { width: 900, height: 700 } })
const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

test('reopened SVG paths have tight selection boxes and retain their artwork placement', async () => {
  const result = await editor.page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const url = '/tests/helpers/canvas/vector-bounds.ts'
    const { createOversizedVectorFile }: typeof BoundsFixture = await import(url)
    const bytes = await createOversizedVectorFile(store.graph, store.state.currentPageId)
    await store.openFigFile(new File([bytes.slice().buffer], 'Vector bounds.fig'))
    const path = [...store.graph.getAllNodes()].find((node) => node.name === 'Coverage path')
    if (!path) throw new Error('Missing reopened path')
    const frame = store.graph.getNode(path.parentId ?? '')
    store.zoomTo100()
    store.pan(-store.state.panX, -store.state.panY)
    store.select([path.id])
    store.requestRender()
    return {
      path: { x: path.x, y: path.y, width: path.width, height: path.height },
      frame: { width: frame?.width, height: frame?.height }
    }
  })
  expect(result).toEqual({
    path: { x: 60, y: 100, width: 120, height: 100 },
    frame: { width: 300, height: 300 }
  })
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  expect(await editor.canvas.screenshotCanvasRegion(420, 420)).toMatchSnapshot(
    'tight-vector-bounds.png'
  )

  const box = await editor.canvas.canvas.boundingBox()
  if (!box) throw new Error('Canvas unavailable')
  // Move the bottom-right vector point. Its parent frame stays 300×300.
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    const id = store?.state.selectedIds.values().next().value
    if (!store || !id) throw new Error('Missing vector selection')
    store.enterNodeEditMode(id)
  })
  await editor.canvas.waitForRender()
  await editor.page.mouse.move(box.x + 220, box.y + 250)
  await editor.page.mouse.down()
  await editor.page.mouse.move(box.x + 260, box.y + 290, { steps: 5 })
  await editor.page.mouse.up()
  const after = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    const edit = store?.getNodeEditState()
    const node = edit && store?.graph.getNode(edit.nodeId)
    return node && { x: node.x, y: node.y, width: node.width, height: node.height }
  })
  expect(after).toEqual({ x: 60, y: 100, width: 160, height: 140 })
  editor.canvas.assertNoErrors()
})
