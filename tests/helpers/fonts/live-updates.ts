import type { Page } from '@playwright/test'

import type { FontManager } from '@open-pencil/core/text'

import type * as AutomationFactory from '@/app/automation/bridge/figma-factory'
import type * as AutomationHandlers from '@/app/automation/bridge/handlers'

/** Hold a real tool's fallback-font work so the visible canvas can be inspected mid-edit. */
export async function createLiveFontUpdate(page: Page) {
  return page.evaluateHandle(async () => {
    const store = window.openPencil?.getStore?.()
    if (!store?.renderer) throw new Error('Editor unavailable')
    const moduleURL = performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .find((url) => url.includes('/packages/core/src/text/fonts.ts'))
    if (!moduleURL) throw new Error('Font runtime unavailable')
    const { fontManager } = (await import(/* @vite-ignore */ moduleURL)) as {
      fontManager: FontManager
    }
    const handlersPath = '/src/app/automation/bridge/handlers.ts'
    const factoryPath = '/src/app/automation/bridge/figma-factory.ts'
    const { createAutomationCommandHandlers } = (await import(
      handlersPath
    )) as typeof AutomationHandlers
    const { makeFigmaFromStore } = (await import(factoryPath)) as typeof AutomationFactory
    const { handleRequest } = createAutomationCommandHandlers(makeFigmaFromStore)
    const fallbackData = await (
      await fetch('/tests/fixtures/fonts/NotoSansCJK-Test.otf')
    ).arrayBuffer()
    await fontManager.loadFont('Inter', 'Regular')
    const frame = store.graph.createNode('FRAME', store.state.currentPageId, {
      name: 'Existing design',
      x: 40,
      y: 60,
      width: 300,
      height: 240,
      fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.4, b: 0.8, a: 1 }, visible: true, opacity: 1 }]
    })
    store.graph.createNode('TEXT', frame.id, {
      name: 'Existing label',
      text: 'Already on the canvas',
      x: 20,
      y: 30,
      width: 260,
      height: 40,
      fontFamily: 'Inter',
      fontSize: 20,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, visible: true, opacity: 1 }]
    })
    store.clearSelection()
    store.requestRender()

    let release = () => undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    let signalRequested = () => undefined
    const requested = new Promise<void>((resolve) => {
      signalRequested = resolve
    })
    const original = fontManager.ensureFallbackPack
    fontManager.ensureFallbackPack = async () => {
      signalRequested()
      await gate
      fontManager.markLoaded('Noto Sans CJK SC', 'Regular', fallbackData)
      fontManager.setCJKFallbackFamily('Noto Sans CJK SC')
      return { 'cjk-sc': ['Noto Sans CJK SC'] }
    }
    let work: Promise<unknown> | undefined
    return {
      async start() {
        work = handleRequest(store, 'tool', {
          name: 'render',
          args: {
            jsx: '<Frame name="New section" x={380} y={60} w={260} h={240} bg="#DC6943"><Text x={20} y={30} w={220} h={50} fontFamily="Inter" fontSize={28} color="#FFFFFF">你好</Text></Frame>'
          }
        })
        await Promise.race([requested, work])
        store.requestRender()
      },
      blocked() {
        return fontManager.isNodeBlocked(frame.id)
      },
      async finish() {
        release()
        await work
        store.requestRender()
      },
      async dispose() {
        release()
        try {
          await work
        } finally {
          fontManager.ensureFallbackPack = original
        }
      }
    }
  })
}
