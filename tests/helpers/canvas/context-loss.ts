import type { Page } from '@playwright/test'

import type * as CanvasKitModule from '@open-pencil/core/canvaskit'

import type * as AppTabs from '@/app/tabs'

import type * as GLSurface from '#vue/canvas/surface/gl-surface'

/** Lose the dormant cleanup context without losing either visible canvas surface. */
export async function createCanvasContextLossProbe(page: Page) {
  return page.evaluateHandle(async () => {
    const kitURL = '/packages/core/src/canvaskit.ts'
    const surfaceURL = '/packages/vue/src/canvas/surface/gl-surface.ts'
    const tabsURL = '/src/app/tabs/index.ts'
    const { getCanvasKit }: typeof CanvasKitModule = await import(kitURL)
    const { releaseWebGLContext }: typeof GLSurface = await import(surfaceURL)
    const tabs: typeof AppTabs = await import(tabsURL)
    const ck = await getCanvasKit()

    // Releasing a current context installs the same dormant context used when a tab closes.
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const handle = ck.GetWebGLContext(canvas)
    if (!handle) throw new Error('WebGL unavailable')
    releaseWebGLContext(ck, handle, canvas)
    canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext()

    const parking: unknown = Reflect.get(ck, 'ctx')
    if (!(parking instanceof WebGL2RenderingContext)) {
      throw new Error('Cleanup context unavailable')
    }
    const extension = parking.getExtension('WEBGL_lose_context')
    if (!extension) throw new Error('Context loss extension unavailable')
    const lost = new Promise<void>((resolve) => {
      parking.canvas.addEventListener('webglcontextlost', () => resolve(), { once: true })
    })
    extension.loseContext()
    await lost

    return {
      createTab() {
        return tabs.createTab().id
      },
      switchTab(id: string) {
        tabs.switchTab(id)
      },
      async closeActiveTab() {
        await tabs.closeTab(tabs.getActiveTabId(), 'discard')
      },
      activeTabId() {
        return tabs.getActiveTabId()
      },
      rendererCount() {
        return tabs.getActiveStore().canvasRenderers.length
      }
    }
  })
}
