import { readFile } from 'node:fs/promises'

import type { Page } from '@playwright/test'

import type { FontManager } from '@open-pencil/core/text'

/** Subset loading is held so the test can observe both instances joining the same request. */
export async function createComponentFontFixture(page: Page) {
  const [small, title] = await Promise.all(
    ['small', 'title'].map(async (name) => [
      ...(await readFile(`tests/fixtures/fonts/Fredoka-Regular-${name}.ttf`))
    ])
  )
  return page.evaluateHandle(
    async ({ small, title }) => {
      const editor = window.openPencil?.getStore?.()
      if (!editor?.renderer) throw new Error('Editor unavailable')
      const moduleURL = '/packages/core/src/text/fonts.ts'
      const { fontManager } = (await import(/* @vite-ignore */ moduleURL)) as {
        fontManager: FontManager
      }
      await fontManager.loadFont('Inter', 'Regular')
      const family = 'Component font regression'
      fontManager.setDownloadedFontCache({
        read: async (_family, _style, characters) =>
          new Uint8Array(characters === 'croak' ? small : title).buffer,
        write: async () => undefined
      })
      await fontManager.loadCachedFont(family, 'Regular', 'croak')
      let release: (() => void) | undefined
      const gate = new Promise<void>((resolve) => {
        release = resolve
      })
      let requests = 0
      const original = fontManager.loadRemoteFont
      fontManager.loadRemoteFont = async (nextFamily, style, characters) => {
        requests++
        await gate
        return fontManager.loadCachedFont(nextFamily, style, characters)
      }
      const component = editor.graph.createNode('COMPONENT', editor.state.currentPageId, {
        name: 'Main component',
        x: 40,
        y: 50,
        width: 520,
        height: 80
      })
      const source = editor.graph.createNode('TEXT', component.id, {
        name: 'Label',
        text: 'croak',
        width: 520,
        height: 80,
        fontFamily: 'Inter',
        fontSize: 44,
        fontWeight: 400,
        fills: [
          { type: 'SOLID', visible: true, opacity: 1, color: { r: 0.1, g: 0.1, b: 0.1, a: 1 } }
        ]
      })
      const property = editor.exposeComponentProperty(source.id, 'TEXT', 'Label')
      if (!property) throw new Error('Missing exposed label')
      const labels = [180, 310].map((y) => {
        const instance = editor.graph.createInstance(component.id, editor.state.currentPageId, {
          x: 40,
          y
        })
        if (!instance) throw new Error('Missing instance')
        editor.setInstanceComponentProperty(instance.id, property, "It's a Croak!")
        const label = editor.graph.getChildren(instance.id)[0]
        if (!label) throw new Error('Missing instance text')
        return label
      })
      editor.zoomTo100()
      editor.pan(-editor.state.panX, -editor.state.panY)
      editor.clearSelection()
      editor.updateNodeWithUndo(source.id, { fontFamily: family })
      return {
        requestCount: () => requests,
        ready: () => labels.every((label) => editor.renderer?.nodeFontReadiness(label) === 'ready'),
        finish: () => release?.(),
        restore: () => {
          release?.()
          fontManager.loadRemoteFont = original
          fontManager.setDownloadedFontCache(null)
        }
      }
    },
    { small, title }
  )
}
