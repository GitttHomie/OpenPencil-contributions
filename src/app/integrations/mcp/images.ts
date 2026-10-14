import { isValid, toUint8Array } from 'js-base64'

import { BLACK } from '@open-pencil/core/constants'

import { makeFigmaFromStore } from '@/app/automation/bridge/figma-factory'
import { executeWithDocumentUndo } from '@/app/automation/execution/editor'
import type { EditorStore } from '@/app/editor/active-store'

/** Returned images become editable frames, with the original bytes in their image fill. */
export async function placeMCPImage(store: EditorStore, dataURL: string, name: string) {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(dataURL)
  if (!match || match[2].length > 32 * 1024 * 1024 || !isValid(match[2])) {
    throw new Error('Invalid MCP image.')
  }
  const pageId = store.state.currentPageId
  const graph = store.graph
  const bytes = toUint8Array(match[2])
  const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: match[1] }))
  const { width, height } = bitmap
  bitmap.close()
  if (store.graph !== graph || store.state.currentPageId !== pageId) {
    throw new Error('The active page changed.')
  }
  return executeWithDocumentUndo(store, pageId, 'Place MCP image', async () => {
    const figma = makeFigmaFromStore(store, pageId)
    const frame = figma.createFrame()
    frame.name = name
    frame.resize(width, height)
    frame.x = figma.viewport.center.x - width / 2
    frame.y = figma.viewport.center.y - height / 2
    graph.updateNode(frame.id, {
      fills: [
        {
          type: 'IMAGE',
          imageHash: figma.createImage(bytes).hash,
          imageScaleMode: 'FILL',
          color: BLACK,
          opacity: 1,
          visible: true
        }
      ]
    })
    store.select([frame.id])
    store.requestRender()
    return frame.id
  })
}
