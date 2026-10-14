import type { Page } from '@playwright/test'

/** Exercise the P3 surface negotiation even on an sRGB CI display. */
export async function emulateWideGamutDisplay(page: Page) {
  await page.addInitScript(() => {
    const matchMedia = window.matchMedia.bind(window)
    window.matchMedia = (query) => {
      const result = matchMedia(query)
      if (query === '(color-gamut: p3)') Object.defineProperty(result, 'matches', { value: true })
      return result
    }
  })
}

/** The wide-gamut notice is the only capability banner whose content names Display-P3. */
export function wideGamutBanner(page: Page) {
  return page.getByRole('status').filter({ hasText: 'Display-P3' })
}

/** Keep the wide-gamut notice from resizing the canvas in rendering-fidelity tests. */
export async function dismissWideGamutBanner(page: Page) {
  const banner = wideGamutBanner(page)
  await banner.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => undefined)
  if (await banner.isVisible()) await banner.locator('[data-slot="banner-dismiss"]').click()
}

/** A fixed scene exercises paint, blur, blending and alpha masks independently of the demo. */
export async function focusPaintEffects(page: Page) {
  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    let subject = store.graph
      .getChildren(store.state.currentPageId)
      .find((node) => node.name === 'P3 paint fixture')
    if (!subject) {
      const paint = (r: number, g: number, b: number) => [
        {
          type: 'SOLID' as const,
          color: { r, g, b, a: 1 },
          visible: true,
          opacity: 1
        }
      ]
      subject = store.graph.createNode('FRAME', store.state.currentPageId, {
        name: 'P3 paint fixture',
        width: 480,
        height: 280,
        fills: paint(0.95, 0.95, 0.98),
        clipsContent: true,
        cornerRadius: 20
      })
      store.graph.createNode('ELLIPSE', subject.id, {
        x: 40,
        y: 40,
        width: 180,
        height: 180,
        fills: paint(1, 0.2, 0.1)
      })
      store.graph.createNode('ELLIPSE', subject.id, {
        x: 140,
        y: 60,
        width: 180,
        height: 180,
        fills: paint(0.1, 0.4, 1),
        blendMode: 'MULTIPLY',
        opacity: 0.7,
        effects: [
          {
            type: 'FOREGROUND_BLUR',
            visible: true,
            radius: 12,
            spread: 0,
            offset: { x: 0, y: 0 },
            color: { r: 0, g: 0, b: 0, a: 1 }
          }
        ]
      })
      const masked = store.graph.createNode('FRAME', subject.id, {
        x: 320,
        y: 80,
        width: 120,
        height: 120,
        fills: []
      })
      store.graph.createNode('ELLIPSE', masked.id, {
        width: 100,
        height: 120,
        isMask: true,
        fills: paint(0, 0, 0)
      })
      store.graph.createNode('RECTANGLE', masked.id, {
        x: -10,
        y: -10,
        width: 140,
        height: 140,
        fills: paint(0.1, 0.9, 0.25)
      })
    }
    store.setDocumentColorSpace('display-p3')
    store.select([subject.id])
    store.zoomToSelection()
    store.clearSelection()
  })
}

export async function waitForSettledScene(page: Page) {
  await page.waitForFunction(() => {
    const store = window.openPencil?.getStore?.()
    const renderer = store?.canvasRenderers.find((r) => r.tracksSceneSettlement)
    return (
      store?.state.navigation.phase === 'idle' &&
      renderer &&
      !renderer.sceneBackingNeedsCrispRender &&
      !renderer.sceneBackingBuild
    )
  })
}

export async function sceneBufferState(page: Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(
      '[data-test-id="scene-canvas-element"]'
    )
    const gl = canvas?.getContext('webgl2')
    if (!gl) throw new Error('Scene WebGL context unavailable')
    return {
      colorSpace: gl.drawingBufferColorSpace,
      documentColorSpace: window.openPencil?.getStore?.().graph.documentColorSpace,
      error: gl.getError()
    }
  })
}
