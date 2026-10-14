import * as v from 'valibot'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { hasEditedLayout, invalidateDerivedLayouts } from '#core/layout/derived'

const metadataSchema = v.pipe(v.string(), v.parseJson(), v.object({ app: v.literal('OpenPencil') }))

function hasStaleStartOffset(graph: SceneGraph, frame: SceneNode): boolean {
  if (
    hasEditedLayout(frame) ||
    (frame.layoutMode !== 'VERTICAL' && frame.layoutMode !== 'HORIZONTAL') ||
    frame.layoutWrap !== 'NO_WRAP' ||
    frame.primaryAxisAlign !== 'MIN' ||
    frame.strokesIncludedInLayout ||
    frame.flipX ||
    frame.flipY
  )
    return false
  const child = graph
    .getChildren(frame.id)
    .find((node) => node.visible && node.layoutPositioning !== 'ABSOLUTE')
  // Text baselines, rotated boxes and RTL layouts can legitimately carry offsets.
  if (!child || child.type === 'TEXT' || child.rotation || child.flipX || child.flipY) return false
  if (frame.layoutMode === 'VERTICAL') return Math.abs(child.y - frame.paddingTop) > 0.01
  const direction = graph.closest(frame.id, (node) => node.layoutDirection !== 'AUTO')
  if (direction?.layoutDirection === 'RTL') return false
  return Math.abs(child.x - frame.paddingLeft) > 0.01
}

/**
 * Older OpenPencil saves can contain new padding with the previous flow geometry.
 * Release only demonstrably inconsistent trees; ordinary Figma imports retain their bounds.
 * Layout itself runs later, once fonts and the page's remaining dependencies are ready.
 */
export function releaseStaleSavedLayouts(graph: SceneGraph, metaJSON: string | null): void {
  if (!v.safeParse(metadataSchema, metaJSON).success) return
  const stale = [...graph.getAllNodes()].filter((node) => hasStaleStartOffset(graph, node))
  if (stale.length === 0) return
  graph.preserveSourceMetadataDuring(() => {
    invalidateDerivedLayouts(
      graph,
      stale.map((node) => node.id)
    )
  })
}
