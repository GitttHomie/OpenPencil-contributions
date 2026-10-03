import type { Fill } from '@open-pencil/scene-graph'
import { copyFills } from '@open-pencil/scene-graph/copy'

/** Replace the photo/base placeholder while retaining overlays above it. */
export function withImageFill(current: readonly Fill[], image: Fill): Fill[] {
  const fills = copyFills([...current])
  const index = fills.findIndex((fill) => fill.type === 'IMAGE')
  if (index !== -1) fills[index] = image
  else if (fills[0]?.type === 'SOLID') fills[0] = image
  else fills.unshift(image)
  return fills
}
