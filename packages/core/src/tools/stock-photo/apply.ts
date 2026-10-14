import { TimeoutError } from 'es-toolkit/error'
import { withTimeout } from 'es-toolkit/promise'

import type { Fill } from '@open-pencil/scene-graph'

import type { FigmaAPI } from '#core/figma-api/index'
import type { FigmaNodeProxy } from '#core/figma-api/proxy'
import { withImageFill } from '#core/tools/modify/fill-stack'

import type { StockPhotoProvider, StockPhotoResult } from './providers'

const STOCK_PHOTO_TARGET_TYPES: ReadonlySet<FigmaNodeProxy['type']> = new Set([
  'FRAME',
  'SLOT',
  'COMPONENT',
  'INSTANCE'
])
// Settle before the MCP bridge's deadline, releasing the document edit queue.
const PHOTO_TIMEOUT_MS = 15_000

export interface PhotoRequest {
  id: string
  query: string
  index?: number
  orientation?: 'landscape' | 'portrait' | 'square'
}

export interface PhotoResult {
  id: string
  photo?: {
    sourceId: string
    photographer: string
    width: number
    height: number
    provider: string
  }
  error?: string
}

export async function applyPhoto(
  figma: FigmaAPI,
  provider: StockPhotoProvider,
  req: PhotoRequest,
  timeoutMs = PHOTO_TIMEOUT_MS
): Promise<PhotoResult> {
  const node = figma.getNodeById(req.id)
  if (!node) return { id: req.id, error: 'Not found' }

  if (!STOCK_PHOTO_TARGET_TYPES.has(node.type)) {
    return {
      id: req.id,
      error: `"${node.name}" (${node.type}) is not a suitable stock photo target. Use a frame with an image fill.`
    }
  }

  const perPage = Math.min((req.index ?? 0) + 3, 15)
  const orientation = req.orientation ?? 'landscape'
  const targetDim = Math.max(node.width, node.height)

  const controller = new AbortController()
  let downloaded: { photo: StockPhotoResult; imageBytes: Uint8Array }
  try {
    // Only preparation runs behind the deadline. A late credential prompt or a
    // provider ignoring cancellation must never place an image after failure.
    downloaded = await withTimeout(
      async () => {
        const results = await provider.search(req.query, {
          perPage,
          orientation,
          targetDim,
          signal: controller.signal
        })
        controller.signal.throwIfAborted()
        if (results.length === 0) throw new Error(`No photos for "${req.query}"`)
        const photo = results[Math.min(req.index ?? 0, results.length - 1)]
        const response = await fetch(photo.url, { signal: controller.signal })
        if (!response.ok) throw new Error(`Download ${response.status}`)
        const imageBytes = new Uint8Array(await response.arrayBuffer())
        controller.signal.throwIfAborted()
        return { photo, imageBytes }
      },
      timeoutMs,
      { signal: controller.signal }
    )
  } catch (err) {
    let error = err instanceof Error ? err.message : String(err)
    if (err instanceof TimeoutError)
      error =
        'Photo access timed out before placement. Check stock-photo credentials or network access before retrying; no image was placed.'
    return {
      id: req.id,
      error
    }
  } finally {
    controller.abort()
  }
  const { photo, imageBytes } = downloaded
  const image = figma.createImage(imageBytes)
  const imageFill: Fill = {
    type: 'IMAGE',
    color: { r: 1, g: 1, b: 1, a: 1 },
    imageHash: image.hash,
    imageScaleMode: 'FILL',
    visible: true,
    opacity: 1
  }
  if (typeof node.fills === 'symbol')
    return {
      id: req.id,
      error: 'This text has mixed character fills; choose a frame for the photo.'
    }
  node.fills = withImageFill(node.fills, imageFill)

  return {
    id: node.id,
    photo: {
      sourceId: photo.sourceId,
      photographer: photo.photographer,
      width: photo.width,
      height: photo.height,
      provider: provider.name
    }
  }
}
