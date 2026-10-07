import { Buffer } from 'node:buffer'

import type { FontManager } from '#core/text/fonts'

import { expect, test } from '#tests/e2e/fixtures'
import { CanvasHelper } from '#tests/helpers/canvas'
import { mockFontsource } from '#tests/helpers/fonts/fontsource'
import { trackFontModuleResources } from '#tests/helpers/fonts/runtime'

test('expanded Fredoka subsets survive font switching and canvas export', async ({ page }) => {
  await trackFontModuleResources(page)
  await mockFontsource(page, [])
  await page.goto('/?test&no-chrome&no-rulers')
  await new CanvasHelper(page).waitForInit()
  const result = await page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    if (!store?.renderer) throw new Error('Editor unavailable')
    const fontModuleURL = performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .find((url) => url.includes('/packages/core/src/text/fonts.ts'))
    if (!fontModuleURL) throw new Error('Active font manager not found')
    const { fontManager } = (await import(/* @vite-ignore */ fontModuleURL)) as {
      fontManager: FontManager
    }
    const [small, complete] = await Promise.all(
      ['small', 'title'].map(async (name) =>
        (await fetch(`/tests/fixtures/fonts/Fredoka-Regular-${name}.ttf`)).arrayBuffer()
      )
    )
    fontManager.markLoaded('Fredoka', 'Regular', small, 'google')
    const node = store.graph.createNode('TEXT', store.state.currentPageId, {
      name: 'Expanded Fredoka subset',
      x: 40,
      y: 40,
      width: 420,
      height: 90,
      text: 'its a croak',
      fontFamily: 'Fredoka',
      fontSize: 64,
      fontWeight: 400,
      textAutoResize: 'NONE',
      fills: [
        { type: 'SOLID', color: { r: 0.1, g: 0.16, b: 0.1, a: 1 }, visible: true, opacity: 1 }
      ]
    })
    await store.loadFontsForNodes([node.id])
    await store.renderExportImage([node.id], 2, 'PNG')
    fontManager.markLoaded('Fredoka', 'Regular', complete, 'google')
    store.graph.updateNode(node.id, { text: "It's a Croak!" })
    await store.loadFontsForNodes([node.id])
    const first = await store.renderExportImage([node.id], 2, 'PNG')
    store.graph.updateNode(node.id, { fontFamily: 'Inter' })
    await store.loadFontsForNodes([node.id])
    await store.renderExportImage([node.id], 2, 'PNG')
    store.graph.updateNode(node.id, { fontFamily: 'Fredoka' })
    await store.loadFontsForNodes([node.id])
    const restored = await store.renderExportImage([node.id], 2, 'PNG')
    const paragraph = store.renderer.buildParagraph(node)
    try {
      return {
        first: first ? Array.from(first) : null,
        restored: restored ? Array.from(restored) : null,
        glyphs: paragraph
          .getShapedLines()
          .flatMap((line) => line.runs.flatMap((run) => [...run.glyphs]))
      }
    } finally {
      paragraph.delete()
    }
  })
  expect(result.glyphs.length).toBeGreaterThan(0)
  expect(result.glyphs).not.toContain(0)
  expect(result.first).not.toBeNull()
  expect(result.restored).toEqual(result.first)
  expect(Buffer.from(result.restored ?? [])).toMatchSnapshot('fredoka-expanded-subset.png')
})
