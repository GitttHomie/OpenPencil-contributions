import { FigmaAPI } from '@open-pencil/core/figma-api'
import { computeContentBounds } from '@open-pencil/core/io'
import { ALL_TOOLS } from '@open-pencil/core/tools'

import { captureReviewSnapshot } from '@/app/ai/review/snapshot'
import { boundedImageScale } from '@/app/ai/tools/vision'
import type { InspectionImage } from '@/app/ai/vision/inspect'
import type { EditorStore } from '@/app/editor/active-store'

const MAX_SUMMARY_CHARS = 32_000
export const MAX_REVIEW_ROOTS = 4

export async function captureDesignCheck(
  store: EditorStore,
  ids: string[],
  withImages: boolean,
  signal?: AbortSignal
) {
  const snapshots: string[] = []
  const images: InspectionImage[] = []
  for (const id of ids) {
    signal?.throwIfAborted()
    const pageId = store.graph.getNode(id)?.parentId
    if (!pageId) continue
    const figma = new FigmaAPI(store.graph)
    figma.currentPage = figma.wrapNode(pageId)
    const spacing = ALL_TOOLS.find((tool) => tool.name === 'analyze_spacing')
    snapshots.push(
      JSON.stringify({
        ...captureReviewSnapshot(store, { pageId, ids: [id] }),
        spacing: spacing ? await spacing.execute(figma, { id }) : undefined
      })
    )
    if (!withImages) continue
    const bounds = computeContentBounds(store.graph, [id])
    if (!bounds) continue
    const scale = boundedImageScale(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY)
    if (scale <= 0) continue
    const data = await store.renderExportImage([id], scale, 'PNG', pageId)
    if (data) images.push({ data, mediaType: 'image/png' })
  }
  signal?.throwIfAborted()
  return { images, summary: snapshots.join('\n').slice(0, MAX_SUMMARY_CHARS) }
}
