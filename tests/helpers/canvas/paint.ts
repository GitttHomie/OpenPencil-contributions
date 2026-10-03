import type { Page } from '@playwright/test'
import { fromUint8Array } from 'js-base64'

import type * as Core from '@open-pencil/core'

export async function createPhotoCard(page: Page, bytes: Uint8Array) {
  return page.evaluate(async (imageData) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    const path = '/packages/core/src/index.ts'
    const core: typeof Core = await import(path)
    const figma = new core.FigmaAPI(store.graph)
    store.graph.addCollection({
      id: 'photo-colors',
      name: 'Photo colors',
      modes: [{ modeId: 'default', name: 'Default' }],
      defaultModeId: 'default',
      variableIds: []
    })
    store.graph.addVariable({
      id: 'photo-base',
      name: 'Photo placeholder',
      type: 'COLOR',
      collectionId: 'photo-colors',
      valuesByMode: { default: { r: 1, g: 0, b: 0, a: 1 } },
      description: '',
      hiddenFromPublishing: false
    })
    const frame = store.graph.createNode('FRAME', store.state.currentPageId, {
      name: 'Photo card with scrim',
      x: 100,
      y: 80,
      width: 280,
      height: 400,
      cornerRadius: 20,
      fills: [],
      boundVariables: { 'fills/0/color': 'photo-base' }
    })
    const imageTool = core.ALL_TOOLS.find((tool) => tool.name === 'set_image_fill')
    if (!imageTool) throw new Error('Image tool unavailable')
    imageTool.execute(figma, { id: frame.id, image_data: imageData })
    store.graph.createNode('TEXT', frame.id, {
      name: 'Caption',
      text: 'A place to unwind',
      x: 24,
      y: 348,
      width: 232,
      height: 28,
      fontSize: 22,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]
    })
    store.clearSelection()
    store.requestRender()
    return frame.id
  }, fromUint8Array(bytes))
}

export async function appendPhotoScrim(page: Page, id: string) {
  return page.evaluate(async (id) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    const path = '/packages/core/src/index.ts'
    const core: typeof Core = await import(path)
    const tool = core.ALL_TOOLS.find((candidate) => candidate.name === 'set_fill')
    if (!tool) throw new Error('Fill tool unavailable')
    const result = tool.execute(new core.FigmaAPI(store.graph), {
      id,
      operation: 'append',
      gradient: 'top-bottom',
      color: '#00000000',
      color_end: '#000000CC'
    })
    store.requestRender()
    return result
  }, id)
}
