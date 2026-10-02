import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { waitForSettledScene } from '#tests/helpers/canvas/color-space'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

test('saving and reopening keeps wrapped, aligned and mixed-style text in place', async () => {
  test.setTimeout(60_000)
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Missing editor')
    for (const [index, align] of (['LEFT', 'CENTER', 'RIGHT'] as const).entries()) {
      store.graph.createNode('TEXT', store.state.currentPageId, {
        name: `Paragraph ${align}`,
        x: 60 + index * 220,
        y: 70,
        width: 180,
        height: 240,
        fontSize: 24,
        fontFamily: 'Inter',
        text: 'Wrapped text stays in its box.\nAnd on a new line.',
        textAutoResize: 'NONE',
        textAlignHorizontal: align,
        textAlignVertical: (['TOP', 'CENTER', 'BOTTOM'] as const)[index],
        lineHeight: index === 1 ? 38 : null,
        fills: [
          { type: 'SOLID', color: { r: 0.1, g: 0.2, b: 0.3, a: 1 }, opacity: 1, visible: true }
        ],
        styleRuns: index === 2 ? [{ start: 0, length: 7, style: { fontSize: 30 } }] : []
      })
    }
    store.state.zoom = 1
    store.state.panX = 0
    store.state.panY = 0
    store.requestRender()
  })
  await editor.canvas.waitForRender()
  const before = await editor.canvas.screenshotCanvasRegion(760, 360)
  expect(before).toMatchSnapshot('native-paragraphs.png')
  const picker = await editor.page.evaluateHandle(() => {
    const original = window.showSaveFilePicker
    const originalOpen = window.showOpenFilePicker
    window.showSaveFilePicker = undefined
    window.showOpenFilePicker = undefined
    return {
      restore: () => {
        window.showSaveFilePicker = original
        window.showOpenFilePicker = originalOpen
      }
    }
  })
  const path = test.info().outputPath('native-paragraphs.fig')
  try {
    editor.page.once('dialog', (dialog) => dialog.accept('native-paragraphs.fig'))
    const download = editor.page.waitForEvent('download')
    await editor.page.keyboard.press('Meta+Shift+s')
    await (await download).saveAs(path)
    const chooser = editor.page.waitForEvent('filechooser')
    await editor.page.keyboard.press('Meta+o')
    await (await chooser).setFiles(path)
  } finally {
    await picker.evaluate((handle) => handle.restore())
    await picker.dispose()
  }
  await editor.page.waitForFunction(() => {
    const store = window.openPencil?.getStore?.()
    const nodes = store?.graph.getChildren(store.state.currentPageId)
    return nodes?.length === 3 && nodes.every((node) => node.source.id !== null)
  })
  await editor.canvas.waitForInit()
  await waitForSettledScene(editor.page)
  const reopened = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Missing editor')
    store.state.zoom = 1
    store.state.panX = 0
    store.state.panY = 0
    store.clearSelection()
    store.requestRender()
    return store.graph.getChildren(store.state.currentPageId).map((node) => ({
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      lineHeight: node.lineHeight,
      glyphs: node.derivedTextGlyphs?.length ?? 0
    }))
  })
  expect(reopened).toEqual(
    [0, 1, 2].map((index) => ({
      x: 60 + index * 220,
      y: 70,
      width: 180,
      height: 240,
      lineHeight: index === 1 ? 38 : null,
      glyphs: 0
    }))
  )
  await editor.canvas.waitForRender()
  await waitForSettledScene(editor.page)
  expect(await editor.canvas.screenshotCanvasRegion(760, 360)).toMatchSnapshot(
    'native-paragraphs.png',
    { maxDiffPixels: 0, threshold: 0 }
  )
  editor.canvas.assertNoErrors()
})
