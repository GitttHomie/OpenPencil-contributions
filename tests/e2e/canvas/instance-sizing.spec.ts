import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import type * as SizingFixture from '#tests/helpers/canvas/instance-sizing'

test.use({ viewport: { width: 900, height: 700 } })

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

test('opening old zero-padding components reflows their contents without editing', async () => {
  const sizes = await editor.page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const fixtureURL = '/tests/helpers/canvas/instance-sizing.ts'
    const { savedStalePaddingScene }: typeof SizingFixture = await import(fixtureURL)
    const data = await savedStalePaddingScene()
    await store.openFigFile(new File([data.slice().buffer], 'OldPadding.fig'))
    store.zoomTo100()
    store.pan(-store.state.panX, -store.state.panY)
    store.clearSelection()
    store.requestRender()
    return [...store.graph.getAllNodes()]
      .filter((node) => node.type === 'COMPONENT' || node.type === 'INSTANCE')
      .map((node) => ({
        height: node.height,
        content: store.graph.getChildren(node.id).map(({ x, y, width, height }) => ({
          x,
          y,
          width,
          height
        }))
      }))
  })
  expect(sizes).toEqual([
    { height: 72, content: [{ x: 0, y: 0, width: 220, height: 72 }] },
    { height: 72, content: [{ x: 0, y: 0, width: 220, height: 72 }] }
  ])
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  expect(await editor.canvas.screenshotCanvasRegion(540, 170)).toMatchSnapshot(
    'reopened-zero-padding.png'
  )
})

test('saved component spacing follows committed previews and restores canceled previews', async () => {
  const sizes = await editor.page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const fixtureURL = '/tests/helpers/canvas/instance-sizing.ts'
    const { createSavedSpacingScene }: typeof SizingFixture = await import(fixtureURL)
    const { mainId, copyId } = createSavedSpacingScene(store.graph, store.state.currentPageId)
    const read = () =>
      [mainId, copyId].map((id) => ({
        height: store.graph.getNode(id)?.height,
        rows: store.graph.getChildren(id).map(({ x, y, width }) => ({ x, y, width }))
      }))
    const preview = store.beginNodePreview('Spacing')
    preview.update(mainId, { itemSpacing: 24, paddingLeft: 24, paddingRight: 24 })
    await Promise.resolve()
    await Promise.resolve()
    preview.commit()
    await Promise.resolve()
    await Promise.resolve()
    const committed = read()
    const canceled = store.beginNodePreview('Canceled spacing')
    canceled.update(mainId, { itemSpacing: 0, paddingTop: 0, paddingBottom: 0 })
    canceled.cancel()
    await Promise.resolve()
    await Promise.resolve()
    store.zoomTo100()
    store.pan(-store.state.panX, -store.state.panY)
    store.clearSelection()
    store.requestRender()
    return { committed, afterCancel: read() }
  })
  const expected = Array.from({ length: 2 }, () => ({
    height: 120,
    rows: [
      { x: 24, y: 16, width: 152 },
      { x: 24, y: 80, width: 152 }
    ]
  }))
  expect(sizes.committed).toEqual(expected)
  expect(sizes.afterCancel).toEqual(expected)
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  expect(await editor.canvas.screenshotCanvasRegion(500, 210)).toMatchSnapshot(
    'saved-spacing-preview.png'
  )
})

test('Fill instances wrap inside narrower parents after component synchronization', async () => {
  await editor.page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const fixtureURL = '/tests/helpers/canvas/instance-sizing.ts'
    const { createInstanceSizingScene }: typeof SizingFixture = await import(fixtureURL)
    const { boardId, componentId } = await createInstanceSizingScene(
      store.graph,
      store.state.currentPageId
    )
    await store.loadFontsForNodes([boardId, componentId])
    store.clearSelection()
    store.zoomToFit()
    store.requestRender()
  })
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot('instance-fill-sizing.png')
})

test('saved instance bounds do not collapse Fill tabs or prevent stretching', async () => {
  const sizes = await editor.page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const fixtureURL = '/tests/helpers/canvas/instance-sizing.ts'
    const { createSavedFillNavigationScene }: typeof SizingFixture = await import(fixtureURL)
    const result = await createSavedFillNavigationScene(store.graph, store.state.currentPageId)
    store.zoomTo100()
    store.pan(-store.state.panX, -store.state.panY)
    store.clearSelection()
    store.requestRender()
    return result
  })
  expect(sizes).toEqual([
    { width: 390, tabs: [93.5, 93.5, 93.5, 93.5] },
    { width: 470, tabs: [113.5, 113.5, 113.5, 113.5] }
  ])
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  expect(await editor.canvas.screenshotCanvasRegion(560, 320)).toMatchSnapshot(
    'saved-fill-navigation.png'
  )
})

test('Fill component contents shrink and rewrap after growing the surrounding frame', async () => {
  const widths = await editor.page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const fixtureURL = '/tests/helpers/canvas/instance-sizing.ts'
    const { createResizingComponentScene }: typeof SizingFixture = await import(fixtureURL)
    const { screenId, componentId } = createResizingComponentScene(
      store.graph,
      store.state.currentPageId
    )
    await store.loadFontsForNodes([screenId, componentId])
    const sizes = []
    for (const width of [500, 240]) {
      store.updateNode(screenId, { width })
      sizes.push(
        store.graph.getChildren(screenId).map((instance) => ({
          width: instance.width,
          content: store.graph.getChildren(instance.id).map((child) => child.width)
        }))
      )
    }
    store.zoomTo100()
    store.pan(-store.state.panX, -store.state.panY)
    store.clearSelection()
    store.requestRender()
    return sizes
  })
  expect(widths).toEqual([
    [
      { width: 500, content: [476] },
      { width: 500, content: [476] }
    ],
    [
      { width: 240, content: [216] },
      { width: 240, content: [216] }
    ]
  ])
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  expect(await editor.canvas.screenshotCanvasRegion(400, 320)).toMatchSnapshot(
    'shrinking-fill-components.png'
  )
})

test('a reopened ordinary Fill frame follows its surrounding width', async () => {
  const sizes = await editor.page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const fixtureURL = '/tests/helpers/canvas/instance-sizing.ts'
    const { createSavedResizingFrameScene }: typeof SizingFixture = await import(fixtureURL)
    const data = await createSavedResizingFrameScene(store.graph, store.state.currentPageId)
    await store.openFigFile(new File([data.slice().buffer], 'Settings.fig'))
    const screen = [...store.graph.getAllNodes()].find((node) => node.name === 'Camera Settings')
    if (!screen) throw new Error('Camera Settings missing')
    await store.loadFontsForNodes([screen.id])
    const widths = []
    for (const width of [500, 240]) {
      store.updateNode(screen.id, { width })
      widths.push(store.graph.getChildren(screen.id).map((child) => child.width))
    }
    store.zoomTo100()
    store.pan(-store.state.panX, -store.state.panY)
    store.clearSelection()
    store.requestRender()
    return widths
  })
  expect(sizes).toEqual([[500], [240]])
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  expect(await editor.canvas.screenshotCanvasRegion(400, 180)).toMatchSnapshot(
    'reopened-fill-frame.png'
  )
})
