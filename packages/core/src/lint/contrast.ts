import type { Color } from '@open-pencil/scene-graph'
import { compositeOver } from '@open-pencil/scene-graph/color'

import { TRANSPARENT } from '#core/constants'

import type { LintNode, RuleContext } from './types'

// null means a spatially varying/unknown paint; an opaque solid above it can still resolve it.
function over(top: Color | null, bottom: Color | null): Color | null {
  if (!top) return null
  if (top.a === 1) return top
  if (!bottom) return null
  const alpha = top.a + bottom.a * (1 - top.a)
  return alpha === 0 ? TRANSPARENT : { ...compositeOver(top, bottom, top.a / alpha), a: alpha }
}

function normalBlend(blendMode: string | undefined): boolean {
  return !blendMode || blendMode === 'NORMAL' || blendMode === 'PASS_THROUGH'
}

function paints(node: LintNode): Color | null {
  let result: Color | null = TRANSPARENT
  for (const fill of node.fills) {
    if (!fill.visible || fill.opacity === 0) continue
    if (!normalBlend(fill.blendMode)) {
      result = null
    } else if (fill.type === 'SOLID' && fill.color) {
      result = over({ ...fill.color, a: (fill.color.a ?? 1) * fill.opacity }, result)
    } else {
      result = null
    }
  }
  return result
}

function fade(color: Color | null, opacity: number): Color | null {
  return color && { ...color, a: color.a * opacity }
}

/** Composite text and its backdrop separately, preserving each ancestor's group opacity. */
export function textContrastColors(
  node: LintNode,
  getParent: RuleContext['getParent']
): { foreground: Color; background: Color } | null {
  if (!node.visible || node.opacity === 0 || !normalBlend(node.blendMode)) return null
  // A single base color cannot describe text with independently painted style ranges.
  if (node.styleRunCount > 0) return null
  let foreground = fade(paints(node), node.opacity ?? 1)
  let background: Color | null = TRANSPARENT
  if (!foreground || foreground.a === 0) return null
  let parent = getParent(node)
  while (parent) {
    if (!parent.visible || parent.opacity === 0 || !normalBlend(parent.blendMode)) return null
    const backdrop = paints(parent)
    foreground = fade(over(foreground, backdrop), parent.opacity ?? 1)
    background = fade(over(background, backdrop), parent.opacity ?? 1)
    parent = getParent(parent)
  }
  // Without an opaque known backdrop there is no defensible numeric contrast ratio.
  return foreground?.a === 1 && background?.a === 1 ? { foreground, background } : null
}
