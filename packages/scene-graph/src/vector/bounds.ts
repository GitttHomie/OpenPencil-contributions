import type { Rect, Vector } from '../primitives'
import type { VectorNetwork } from '../types'

export interface CubicPoints {
  p0: Vector
  cp1: Vector
  cp2: Vector
  p3: Vector
}

export function evalCubic(
  p0x: number,
  p0y: number,
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number,
  p3x: number,
  p3y: number,
  t: number
): Vector {
  const mt = 1 - t
  const mt2 = mt * mt
  const t2 = t * t
  const a = mt2 * mt
  const b = 3 * mt2 * t
  const c = 3 * mt * t2
  const d = t2 * t
  return {
    x: a * p0x + b * p1x + c * p2x + d * p3x,
    y: a * p0y + b * p1y + c * p2y + d * p3y
  }
}

export function segmentToAbsolute(network: VectorNetwork, segmentIndex: number): CubicPoints {
  const seg = network.segments[segmentIndex]
  const v0 = network.vertices[seg.start]
  const v1 = network.vertices[seg.end]
  return {
    p0: { x: v0.x, y: v0.y },
    cp1: { x: v0.x + seg.tangentStart.x, y: v0.y + seg.tangentStart.y },
    cp2: { x: v1.x + seg.tangentEnd.x, y: v1.y + seg.tangentEnd.y },
    p3: { x: v1.x, y: v1.y }
  }
}

export function cubicExtrema(p0: number, p1: number, p2: number, p3: number): number[] {
  const a = -p0 + 3 * p1 - 3 * p2 + p3
  const b = 2 * (p0 - 2 * p1 + p2)
  const c = -p0 + p1

  const results: number[] = []
  const EPS = 1e-12

  if (Math.abs(a) < EPS) {
    // Linear: bt + c = 0
    if (Math.abs(b) > EPS) {
      const t = -c / b
      if (t > 0 && t < 1) results.push(t)
    }
  } else {
    const disc = b * b - 4 * a * c
    if (disc >= 0) {
      const sq = Math.sqrt(disc)
      const t1 = (-b + sq) / (2 * a)
      const t2 = (-b - sq) / (2 * a)
      if (t1 > 0 && t1 < 1) results.push(t1)
      if (t2 > 0 && t2 < 1 && Math.abs(t2 - t1) > EPS) results.push(t2)
    }
  }

  return results
}

export function computeAccurateBounds(network: VectorNetwork): Rect {
  const { vertices, segments } = network
  if (vertices.length === 0) return { x: 0, y: 0, width: 0, height: 0 }

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity

  const update = (x: number, y: number) => {
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }

  // Include all vertex positions
  for (const v of vertices) update(v.x, v.y)

  // For each segment, find curve extrema
  for (let i = 0; i < segments.length; i++) {
    const { p0, cp1, cp2, p3 } = segmentToAbsolute(network, i)

    // X extrema
    for (const t of cubicExtrema(p0.x, cp1.x, cp2.x, p3.x)) {
      const pt = evalCubic(p0.x, p0.y, cp1.x, cp1.y, cp2.x, cp2.y, p3.x, p3.y, t)
      update(pt.x, pt.y)
    }

    // Y extrema
    for (const t of cubicExtrema(p0.y, cp1.y, cp2.y, p3.y)) {
      const pt = evalCubic(p0.x, p0.y, cp1.x, cp1.y, cp2.x, cp2.y, p3.x, p3.y, t)
      update(pt.x, pt.y)
    }
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}
