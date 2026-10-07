import type { Canvas } from 'canvaskit-wasm'

import type { SkiaRenderer } from '#core/canvas/renderer'

export const PIXEL_GRID_MIN_ZOOM = 4

/** Visible document-pixel boundaries, aligned to device pixels after pan and zoom. */
export function pixelGridLines(pan: number, zoom: number, extent: number, dpr: number): number[] {
  if (
    ![pan, zoom, extent, dpr].every(Number.isFinite) ||
    zoom < PIXEL_GRID_MIN_ZOOM ||
    extent <= 0 ||
    dpr <= 0
  )
    return []
  const first = ((pan % zoom) + zoom) % zoom
  const positions: number[] = []
  for (let position = first; position <= extent; position += zoom) {
    positions.push(Math.round(position * dpr) / dpr)
  }
  return positions
}

export function drawPixelGrid(r: SkiaRenderer, canvas: Canvas): void {
  if (r.zoom < PIXEL_GRID_MIN_ZOOM) return
  const width = 1 / r.dpr
  r.auxFill.setColor(r.ck.Color4f(0.5, 0.5, 0.5, 0.4))
  for (const x of pixelGridLines(r.panX, r.zoom, r.viewportWidth, r.dpr)) {
    canvas.drawRect(r.ck.LTRBRect(x, 0, x + width, r.viewportHeight), r.auxFill)
  }
  for (const y of pixelGridLines(r.panY, r.zoom, r.viewportHeight, r.dpr)) {
    canvas.drawRect(r.ck.LTRBRect(0, y, r.viewportWidth, y + width), r.auxFill)
  }
}
