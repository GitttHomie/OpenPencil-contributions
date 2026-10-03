import type { Vector } from '@open-pencil/scene-graph'

export interface GradientSnapGuide {
  start: Vector
  end: Vector
}
export interface GradientSnapResult {
  position: Vector
  guides: GradientSnapGuide[]
}

const SNAP_DISTANCE_PX = 6
const DIRECTION_TOLERANCE = Math.PI / 36
const EPSILON = 1e-6

function nearest(value: number, targets: number[], threshold: number): number | undefined {
  return targets
    .filter((target) => Math.abs(target - value) <= threshold)
    .sort((a, b) => Math.abs(a - value) - Math.abs(b - value))[0]
}

function directionAt(
  point: Vector,
  origin: Vector,
  width: number,
  height: number,
  threshold: number,
  constrain: boolean
): Vector | null {
  const angle = Math.atan2(point.y - origin.y, point.x - origin.x)
  if (constrain) {
    const snapped = Math.round(angle / (Math.PI / 12)) * (Math.PI / 12)
    return { x: Math.cos(snapped), y: Math.sin(snapped) }
  }
  const length = Math.hypot(point.x - origin.x, point.y - origin.y)
  if (length < threshold * 2) return null
  const diagonal = Math.atan2(height, width)
  const angles = [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4, diagonal, -diagonal]
  let best: Vector | null = null
  let distance = threshold
  for (const candidate of angles) {
    const direction = { x: Math.cos(candidate), y: Math.sin(candidate) }
    const perpendicular = Math.abs(
      (point.x - origin.x) * direction.y - (point.y - origin.y) * direction.x
    )
    if (perpendicular <= distance && perpendicular / length <= Math.sin(DIRECTION_TOLERANCE)) {
      distance = perpendicular
      best = direction
    }
  }
  return best
}

function alignDirection(
  point: Vector,
  origin: Vector,
  direction: Vector,
  x: number | undefined,
  y: number | undefined,
  threshold: number
): Vector {
  const length = (point.x - origin.x) * direction.x + (point.y - origin.y) * direction.y
  const projected = { x: origin.x + direction.x * length, y: origin.y + direction.y * length }
  const intersections: Vector[] = []
  if (x !== undefined && Math.abs(direction.x) > EPSILON)
    intersections.push({ x, y: origin.y + ((x - origin.x) * direction.y) / direction.x })
  if (y !== undefined && Math.abs(direction.y) > EPSILON)
    intersections.push({ x: origin.x + ((y - origin.y) * direction.x) / direction.y, y })
  return (
    intersections
      .filter(
        (candidate) =>
          Math.hypot(candidate.x - point.x, candidate.y - point.y) <= threshold * Math.SQRT2
      )
      .sort(
        (a, b) =>
          Math.hypot(a.x - point.x, a.y - point.y) - Math.hypot(b.x - point.x, b.y - point.y)
      )[0] ?? projected
  )
}

/** Work in node-local coordinates; keep the magnetic distance constant on screen. */
export function snapGradientPoint(
  point: Vector,
  origin: Vector | null,
  width: number,
  height: number,
  options: { zoom?: number; constrain?: boolean; disabled?: boolean } = {}
): GradientSnapResult {
  if (options.disabled || width <= 0 || height <= 0) return { position: point, guides: [] }
  const threshold = SNAP_DISTANCE_PX / Math.max(options.zoom ?? 1, 0.01)
  const x = nearest(point.x, [0, width / 2, width], threshold)
  const y = nearest(point.y, [0, height / 2, height], threshold)
  let position = { x: x ?? point.x, y: y ?? point.y }
  const direction = origin
    ? directionAt(point, origin, width, height, threshold, options.constrain ?? false)
    : null
  let aligned = false
  // Corners and edge midpoints take priority, including diagonals of non-square objects.
  if (direction && origin && (x === undefined || y === undefined)) {
    position = alignDirection(point, origin, direction, x, y, threshold)
    aligned = true
  }
  const guides: GradientSnapGuide[] = []
  if (x !== undefined && Math.abs(position.x - x) < EPSILON)
    guides.push({ start: { x, y: 0 }, end: { x, y: height } })
  if (y !== undefined && Math.abs(position.y - y) < EPSILON)
    guides.push({ start: { x: 0, y }, end: { x: width, y } })
  if (aligned && origin) guides.push({ start: origin, end: position })
  return { position, guides }
}
