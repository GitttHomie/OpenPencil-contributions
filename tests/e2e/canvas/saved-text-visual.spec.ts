import { readFile } from 'node:fs/promises'

import { parseFigBuffer } from '@open-pencil/fig'

import { expect, test } from '#tests/e2e/fixtures'
import { CanvasHelper } from '#tests/helpers/canvas'
import { createFillTextWrapScene } from '#tests/helpers/canvas/fill-text'

const MESSAGE = 'A sentence long enough that it has to wrap onto a second line.'

test('Fill labels draw within their growing bounds in a component and narrower instance', async ({
  page
}) => {
  await page.goto('/?test&no-chrome&no-rulers')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  const [main, instance] = await createFillTextWrapScene(page)
  expect(main).toMatchObject({ width: 269, autoResize: 'WIDTH_AND_HEIGHT' })
  expect(instance).toMatchObject({ width: 160, autoResize: 'WIDTH_AND_HEIGHT' })
  expect(main.height).toBeGreaterThan(24)
  expect(instance.height).toBeGreaterThan(main.height)
  await canvas.waitForRender()
  canvas.assertNoErrors()
  expect(await canvas.screenshotCanvasRegion(570, 300)).toMatchSnapshot('fill-text-wrap.png')
})

test('wrapped text keeps its lines after a .fig is saved and reopened (#914)', async ({ page }) => {
  await page.goto('/?test&no-chrome&no-rulers')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await page.evaluate((message) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    const card = store.graph.createNode('FRAME', store.state.currentPageId, {
      name: 'Card',
      width: 260,
      height: 52,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, visible: true, opacity: 1 }]
    })
    store.graph.createNode('TEXT', card.id, {
      name: 'Message',
      text: message,
      x: 10,
      y: 10,
      width: 230,
      height: 32,
      fontFamily: 'Inter',
      fontSize: 13,
      lineHeight: 16,
      textAutoResize: 'HEIGHT',
      fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1, a: 1 }, visible: true, opacity: 1 }]
    })
  }, MESSAGE)

  const picker = await page.evaluateHandle(() => {
    const original = window.showSaveFilePicker
    window.showSaveFilePicker = undefined
    return {
      restore: () => {
        window.showSaveFilePicker = original
      }
    }
  })
  let bytes: number[]
  try {
    page.once('dialog', (dialog) => dialog.accept('Card.fig'))
    const download = page.waitForEvent('download')
    await page.evaluate(() => window.openPencil?.getStore?.().saveFigFileAs())
    bytes = [...(await readFile(await (await download).path()))]
  } finally {
    await picker.evaluate((handle) => handle.restore())
    await picker.dispose()
  }

  const archive = parseFigBuffer(new Uint8Array(bytes).buffer)
  const savedText = archive.nodeChanges.find((node) => node.name === 'Message')
  expect(new Set(savedText?.derivedTextData?.glyphs?.map((glyph) => glyph.position.y)).size).toBe(2)

  const restored = await page.evaluate(async (saved) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    await store.openFigFile(new File([new Uint8Array(saved)], 'Card.fig'))
    const message = [...store.graph.nodes.values()].find((node) => node.name === 'Message')
    store.requestRender()
    return {
      text: message?.text,
      width: message?.width,
      lineHeight: message?.lineHeight,
      nativeParagraph: message?.derivedTextGlyphs.length === 0
    }
  }, bytes)
  expect(restored).toEqual({ text: MESSAGE, width: 230, lineHeight: 16, nativeParagraph: true })
  await canvas.waitForRender()
  expect(await canvas.screenshotCanvasRegion()).toMatchSnapshot('reopened-wrapped-text.png')
})
