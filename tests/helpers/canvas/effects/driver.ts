import type { Page } from '@playwright/test'

import type * as EffectScenes from '#tests/helpers/canvas/effects/scene'

/** Builds the blur effects scene on the open page and leaves it unselected for a snapshot. */
export function blurEffectsDriver(page: () => Page) {
  return {
    showImported() {
      return page().evaluate(async () => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        const sceneURL = '/tests/helpers/canvas/effects/scene.ts'
        const scenes: typeof EffectScenes = await import(sceneURL)
        const ids = scenes.createImportedEffectsScene(store.graph, store.state.currentPageId)
        store.state.zoom = 1
        store.state.panX = 1700
        store.state.panY = -3200
        store.clearSelection()
        store.requestRender()
        return ids
      })
    },
    showInvalidNode(id: string) {
      return page().evaluate((nodeId) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        store.graph.updateNode(nodeId, { visible: true })
        store.requestRender()
      }, id)
    },
    settle() {
      return page().evaluate(() => window.openPencil?.test?.navigation?.waitForSettlement())
    },
    preview(id: string) {
      return page().evaluateHandle((nodeId) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        const node = store.graph.getNode(nodeId)
        const renderer = store.canvasRenderers.find((candidate) => candidate.tracksSceneSettlement)
        if (!node || !renderer) throw new Error('Preview target unavailable')
        const image = renderer.foregroundBlurCache.peek(nodeId)?.image
        if (!image) throw new Error('Foreground blur preview was not prepared')
        const x = node.x
        const release = store.beginInteractiveEdit()
        return {
          move() {
            store.graph.updateNode(nodeId, { x: x + 100 })
            store.requestRepaint()
          },
          reusesImage() {
            return renderer.foregroundBlurCache.peek(nodeId)?.image === image
          },
          restore() {
            store.graph.updateNode(nodeId, { x })
            release()
            store.requestRender()
          }
        }
      }, id)
    },
    show() {
      return page().evaluate(async () => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        const sceneURL = '/tests/helpers/canvas/effects/scene.ts'
        const scenes: typeof EffectScenes = await import(sceneURL)
        scenes.createBlurEffectsScene(store.graph, store.state.currentPageId)
        store.clearSelection()
        store.requestRender()
      })
    }
  }
}
