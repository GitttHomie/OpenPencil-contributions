import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

test('Option hover shows temporary distances between layers', async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.state.zoom = 1
    store.state.panX = 0
    store.state.panY = 0
    const pageId = store.state.currentPageId
    const selected = store.graph.createNode('RECTANGLE', pageId, {
      name: 'Selected',
      x: 120,
      y: 140,
      width: 100,
      height: 80,
      fills: [
        { type: 'SOLID', color: { r: 0.25, g: 0.52, b: 0.96, a: 1 }, visible: true, opacity: 1 }
      ]
    })
    store.graph.createNode('RECTANGLE', pageId, {
      name: 'Target',
      x: 300,
      y: 290,
      width: 120,
      height: 90,
      fills: [
        { type: 'SOLID', color: { r: 0.95, g: 0.55, b: 0.2, a: 1 }, visible: true, opacity: 1 }
      ]
    })
    store.select([selected.id])
    store.requestRender()
  })
  await editor.canvas.waitForRender()

  await editor.canvas.hover(340, 330)
  await editor.page.keyboard.down('Alt')
  await expect
    .poll(() => editor.page.evaluate(() => window.openPencil?.getStore?.().state.measurementMode))
    .toBe('shallow')
  await editor.canvas.waitForRender()

  expect(
    await editor.page.screenshot({
      clip: { x: 80, y: 90, width: 390, height: 340 }
    })
  ).toMatchSnapshot('distance-measurement.png')

  await editor.page.keyboard.up('Alt')
  await expect
    .poll(() => editor.page.evaluate(() => window.openPencil?.getStore?.().state.measurementMode))
    .toBe('off')
})

test('deep measurement modifier targets a nested component child', async () => {
  const ids = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.state.zoom = 1
    store.state.panX = 0
    store.state.panY = 0
    const pageId = store.state.currentPageId
    const selected = store.graph.createNode('RECTANGLE', pageId, {
      x: 100,
      y: 100,
      width: 50,
      height: 50
    })
    const component = store.graph.createNode('COMPONENT', pageId, {
      x: 250,
      y: 100,
      width: 200,
      height: 160,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, visible: true, opacity: 1 }]
    })
    const child = store.graph.createNode('RECTANGLE', component.id, {
      x: 30,
      y: 30,
      width: 80,
      height: 60
    })
    store.select([selected.id])
    store.requestRender()
    return { componentId: component.id, childId: child.id }
  })
  await editor.canvas.waitForRender()
  await editor.canvas.hover(300, 150)

  await editor.page.keyboard.down('Alt')
  await expect
    .poll(() => editor.page.evaluate(() => window.openPencil?.getStore?.().state.hoveredNodeId))
    .toBe(ids.componentId)
  await editor.page.keyboard.down('Control')
  await expect
    .poll(() => editor.page.evaluate(() => window.openPencil?.getStore?.().state.hoveredNodeId))
    .toBe(ids.childId)

  await editor.page.keyboard.up('Control')
  await editor.page.keyboard.up('Alt')
})

for (const modifier of ['Meta', 'Control', null]) {
  test(`${modifier ? `${modifier}+` : ''}Option nudges while measurements stay visible`, async () => {
    const ids = await editor.page.evaluate((deep) => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not initialized')
      store.zoomTo100()
      store.pan(-store.state.panX, -store.state.panY)
      const selected = store.graph.createNode('RECTANGLE', store.state.currentPageId, {
        name: 'Moving layer',
        x: 120,
        y: 140,
        width: 100,
        height: 80,
        fills: [
          { type: 'SOLID', color: { r: 0.25, g: 0.52, b: 0.96, a: 1 }, visible: true, opacity: 1 }
        ]
      })
      const component = store.graph.createNode('COMPONENT', store.state.currentPageId, {
        name: 'Measured component',
        x: 300,
        y: 290,
        width: 160,
        height: 130,
        fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, visible: true, opacity: 1 }]
      })
      const target = store.graph.createNode('RECTANGLE', component.id, {
        name: 'Nested target',
        x: 20,
        y: 20,
        width: 120,
        height: 90,
        fills: [
          { type: 'SOLID', color: { r: 0.95, g: 0.55, b: 0.2, a: 1 }, visible: true, opacity: 1 }
        ]
      })
      store.select([selected.id])
      store.requestRender()
      return { selected: selected.id, target: deep ? target.id : component.id }
    }, Boolean(modifier))
    const read = () =>
      editor.page.evaluate(({ selected, target }) => {
        const store = window.openPencil?.getStore?.()
        const node = store?.graph.getNode(selected)
        const measured = store?.graph.getNode(target)
        if (!store || !node || !measured) throw new Error('Missing measurement nodes')
        const position = store.graph.getAbsolutePosition(target)
        return {
          x: node.x,
          y: node.y,
          horizontalGap: position.x - node.x - node.width,
          verticalGap: position.y - node.y - node.height,
          mode: store.state.measurementMode,
          hovered: store.state.hoveredNodeId,
          selected: [...store.state.selectedIds]
        }
      }, ids)

    await editor.canvas.waitForRender()
    await editor.canvas.hover(360, 350)
    await editor.page.keyboard.down('Alt')
    if (modifier) await editor.page.keyboard.down(modifier)
    for (const [key, x, y] of [
      ['ArrowRight', 121, 140],
      ['ArrowLeft', 120, 140],
      ['ArrowUp', 120, 139],
      ['ArrowDown', 120, 140],
      ['ArrowRight', 121, 140],
      ['Shift+ArrowRight', 131, 140]
    ] as const) {
      await editor.page.keyboard.press(key)
      await expect.poll(read).toMatchObject({
        x,
        y,
        mode: modifier ? 'deep' : 'shallow',
        hovered: ids.target,
        selected: [ids.selected]
      })
    }
    await editor.page.evaluate(() => window.openPencil?.getStore?.().flushNudge())
    await editor.page.keyboard.press('Shift+ArrowDown')
    await expect.poll(read).toEqual({
      x: 131,
      y: 150,
      horizontalGap: modifier ? 89 : 69,
      verticalGap: modifier ? 80 : 60,
      mode: modifier ? 'deep' : 'shallow',
      hovered: ids.target,
      selected: [ids.selected]
    })
    await editor.canvas.waitForRender()
    if (modifier) {
      expect(await editor.canvas.screenshotCanvasRegion(500, 460)).toMatchSnapshot(
        'distance-measurement-nudge.png'
      )
      await editor.page.keyboard.up(modifier)
    }
    await editor.page.keyboard.up('Alt')
    await expect.poll(read).toMatchObject({ mode: 'off' })
    await editor.page.keyboard.press('Meta+z')
    await expect.poll(read).toMatchObject({ x: 131, y: 140 })
    await editor.page.keyboard.press('Shift+ArrowLeft')
    await expect.poll(read).toMatchObject({ x: 121, y: 140, mode: 'off' })
    editor.canvas.assertNoErrors()
  })
}
