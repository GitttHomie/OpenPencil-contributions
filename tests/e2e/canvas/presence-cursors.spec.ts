import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { createCanvasActivityProbe } from '#tests/helpers/chat/canvas-activity'

test.use({ viewport: { width: 900, height: 700 } })

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

test('an ACP agent is visible before rendering a batch, follows its result, and clears on finish', async () => {
  const testInfo = test.info()
  const activity = await createCanvasActivityProbe(editor.page)
  try {
    const before = await activity.snapshot()
    const empty = await editor.canvas.screenshotCanvasRegion(900, 700)
    await activity.start()
    await editor.canvas.waitForRender()
    const thinking = await activity.snapshot()
    expect(thinking.children).toEqual(before.children)
    expect(thinking.cursors).toMatchObject([{ kind: 'agent' }])
    await expect(editor.page.getByTestId('agent-cursors')).toBeVisible()
    const visible = await editor.canvas.screenshotCanvasRegion(900, 700)
    expect(visible.equals(empty)).toBe(false)
    await testInfo.attach('agent-before-canvas-edits', { body: visible, contentType: 'image/png' })
    await activity.finish()
    await editor.canvas.waitForRender()
    expect((await activity.snapshot()).cursors).toEqual([])
    await expect(editor.page.getByTestId('agent-cursors')).toBeHidden()
    expect((await editor.canvas.screenshotCanvasRegion(900, 700)).equals(empty)).toBe(true)
    await activity.start()
    const id = await activity.render()
    expect((await activity.snapshot()).cursors).toMatchObject([
      { kind: 'agent', x: 200, y: 150, selection: [id] }
    ])
    await activity.finish()
    expect((await activity.snapshot()).cursors).toEqual([])
    editor.canvas.assertNoErrors()
  } finally {
    await activity.dispose()
  }
})

test('people and agents show arrows in their color, agents with an outlined sparkle label', async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const pageId = store.state.currentPageId
    const card = store.graph.createNode('RECTANGLE', pageId, {
      name: 'Card',
      x: 220,
      y: 220,
      width: 160,
      height: 100,
      fills: [
        { type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.92, a: 1 }, opacity: 1, visible: true }
      ]
    })
    const ana = { r: 0.92, g: 0.34, b: 0.29, a: 1 }
    const ben = { r: 0.2, g: 0.55, b: 0.95, a: 1 }
    store.state.panX = 0
    store.state.panY = 0
    store.state.zoom = 1
    store.state.presenceCursors = [
      { kind: 'person', name: 'Ana', color: ana, x: 120, y: 120 },
      { kind: 'agent', name: 'Fern', color: ana, x: 220, y: 220, selection: [card.id] },
      { kind: 'agent', name: 'Orbit', color: ben, x: 440, y: 180 }
    ]
    store.clearSelection()
    store.requestRender()
  })
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  expect(await editor.canvas.screenshotCanvasRegion(600, 420)).toMatchSnapshot(
    'presence-cursors.png'
  )
})
