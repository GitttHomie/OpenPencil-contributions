import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import type * as FooterFixture from '#tests/helpers/canvas/hug-columns'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

test('Hug footer columns and their instance remain visible with real text measurement', async () => {
  const sizes = await editor.page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor missing')
    const fixturePath = '/tests/helpers/canvas/hug-columns.ts'
    const fixture: typeof FooterFixture = await import(fixturePath)
    const ids = fixture.createHugColumnFooter(store.graph, store.state.currentPageId)
    await store.loadFontsForNodes(ids)
    for (const id of ids) store.runLayoutForNode(id)
    store.zoomTo100()
    store.pan(-store.state.panX, -store.state.panY)
    store.clearSelection()
    store.requestRender()
    return ids.map((id) => store.graph.getChildren(id).map(({ x, width }) => ({ x, width })))
  })
  for (const columns of sizes) {
    expect(columns).toHaveLength(3)
    expect(columns[0].x).toBe(24)
    expect(columns[2].x + columns[2].width).toBeCloseTo(576)
    for (const column of columns) expect(column.width).toBeLessThan(150)
  }
  await editor.canvas.waitForRender()
  expect(await editor.canvas.screenshotCanvasRegion(680, 340)).toMatchSnapshot(
    'hug-footer-columns.png'
  )
  editor.canvas.assertNoErrors()
})
