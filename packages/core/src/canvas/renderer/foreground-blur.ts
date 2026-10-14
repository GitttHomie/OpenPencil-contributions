import type { Canvas } from 'canvaskit-wasm'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { blurSigma } from '#core/canvas/effects'
import type { SkiaRenderer } from '#core/canvas/renderer'

import {
  canCacheEffectRaster,
  effectRasterScale,
  effectRasterScaleMatches,
  type EffectRasterCacheEntry
} from './effect-raster-cache'

export const FOREGROUND_BLUR_CACHE_PIXELS = 8_000_000

export function containsForegroundBlur(graph: SceneGraph, rootId: string): boolean {
  const pending = [rootId]
  while (pending.length > 0) {
    const id = pending.pop()
    const node = id ? graph.getNode(id) : undefined
    if (!node?.visible) continue
    if (
      node.childIds.length === 0 &&
      node.effects.some(
        (effect) =>
          effect.visible && (effect.type === 'LAYER_BLUR' || effect.type === 'FOREGROUND_BLUR')
      )
    )
      return true
    pending.push(...node.childIds)
  }
  return false
}

function supportsPreview(node: SceneNode): boolean {
  return !(
    node.childIds.length > 0 ||
    node.rotation !== 0 ||
    node.flipX ||
    node.flipY ||
    !['RECTANGLE', 'ROUNDED_RECTANGLE', 'ELLIPSE'].includes(node.type) ||
    node.fills.some((fill) => fill.type === 'IMAGE') ||
    node.strokes.some((stroke) => stroke.type === 'IMAGE')
  )
}

function drawRaster(r: SkiaRenderer, canvas: Canvas, entry: EffectRasterCacheEntry): void {
  canvas.drawImageRectOptions(
    entry.image,
    r.ck.LTRBRect(0, 0, entry.image.width(), entry.image.height()),
    r.ck.LTRBRect(entry.left, entry.top, entry.left + entry.width, entry.top + entry.height),
    r.ck.FilterMode.Linear,
    r.ck.MipmapMode.None,
    null
  )
}

/**
 * Rasterize independent blurred shapes for navigation and manipulation previews. Backdrop
 * effects, text, children and live images keep their regular rendering path. Settled drawing
 * and exports never consume these previews.
 */
export function drawForegroundBlurPreview(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  draw: (canvas: Canvas) => void,
  canBuild = true
): boolean {
  if (!r.renderingSceneBacking || !supportsPreview(node)) return false

  const effects = node.effects.filter((effect) => effect.visible)
  const blur = effects.find(
    (effect) => effect.type === 'LAYER_BLUR' || effect.type === 'FOREGROUND_BLUR'
  )
  if (
    !blur ||
    blur.radius <= 0 ||
    effects.some(
      (effect) => effect !== blur && effect.type !== 'DROP_SHADOW' && effect.type !== 'INNER_SHADOW'
    )
  )
    return false

  // Include the blur's tails and any stroke/shadow entering the blur.
  const strokeMargin = node.strokes.reduce(
    (margin, stroke) => (stroke.visible ? Math.max(margin, stroke.weight) : margin),
    0
  )
  const shadowMargin = effects.reduce(
    (margin, effect) =>
      effect === blur
        ? margin
        : Math.max(
            margin,
            effect.radius * 2 +
              Math.abs(effect.spread) +
              Math.max(Math.abs(effect.offset.x), Math.abs(effect.offset.y))
          ),
    0
  )
  const margin = blur.radius * 2 + shadowMargin + strokeMargin
  const width = node.width + margin * 2
  const height = node.height + margin * 2
  const scale = effectRasterScale(r.zoom * r.dpr)
  const cached = r.foregroundBlurCache.get(node.id)
  if (cached) {
    if (
      cached.width === width &&
      cached.height === height &&
      cached.fontGeneration === r.fontGeneration &&
      (cached.scale === scale || effectRasterScaleMatches(cached.scale, r.zoom * r.dpr))
    ) {
      drawRaster(r, canvas, cached)
      return true
    }
    r.foregroundBlurCache.delete(node.id)
  }
  if (!canBuild || !canCacheEffectRaster(width, height, scale)) return false

  const surface = r.surface.makeSurface({
    width: Math.ceil(width * scale),
    height: Math.ceil(height * scale),
    colorType: r.ck.ColorType.RGBA_8888,
    alphaType: r.ck.AlphaType.Premul,
    colorSpace: r.ck.ColorSpace.SRGB
  })
  // CanvasKit can return null on GPU allocation failure despite its declared Surface return type.
  // oxlint-disable-next-line typescript-eslint/no-unnecessary-condition
  if (!surface) return false
  const paint = new r.ck.Paint()
  try {
    const raster = surface.getCanvas()
    raster.clear(r.ck.TRANSPARENT)
    raster.scale(scale, scale)
    raster.translate(margin, margin)
    paint.setImageFilter(r.getCachedBlur(blurSigma(blur.radius)))
    raster.saveLayer(
      paint,
      r.ck.LTRBRect(-margin, -margin, node.width + margin, node.height + margin)
    )
    draw(raster)
    raster.restore()
    surface.flush()
    const image = surface.makeImageSnapshot()
    const entry: EffectRasterCacheEntry = {
      image,
      left: -margin,
      top: -margin,
      width,
      height,
      scale,
      pixels: image.width() * image.height(),
      fontGeneration: r.fontGeneration,
      dependencyIds: []
    }
    const retained = r.foregroundBlurCache.set(node.id, entry)
    try {
      drawRaster(r, canvas, entry)
    } finally {
      if (!retained) image.delete()
    }
    return true
  } finally {
    paint.delete()
    surface.delete()
  }
}
