import type { Fill, GradientTransform, Vector } from '@open-pencil/scene-graph'

export type GradientHandle = 'start' | 'end' | 'center' | 'radius-x' | 'radius-y'
export interface GradientHandles {
  start: Vector
  end: Vector
  center: Vector
  radiusY?: Vector
}

function point(t: GradientTransform, width: number, height: number, x: number, y: number): Vector {
  return {
    x: (t.m00 * x + t.m01 * y + t.m02) * width,
    y: (t.m10 * x + t.m11 * y + t.m12) * height
  }
}

export function gradientHandles(
  type: Fill['type'],
  t: GradientTransform,
  width: number,
  height: number
): GradientHandles {
  if (type === 'GRADIENT_LINEAR') {
    const start = point(t, width, height, 1, 0)
    const end = point(t, width, height, 0, 0)
    return { start, end, center: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 } }
  }
  const center = point(t, width, height, 0.5, 0.5)
  return {
    start: center,
    end: point(t, width, height, 1, 0.5),
    center,
    radiusY: point(t, width, height, 0.5, 1)
  }
}

function snapDirection(origin: Vector, position: Vector, snap: boolean): Vector {
  if (!snap) return position
  const dx = position.x - origin.x
  const dy = position.y - origin.y
  const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 12)) * (Math.PI / 12)
  const length = Math.hypot(dx, dy)
  return { x: origin.x + Math.cos(angle) * length, y: origin.y + Math.sin(angle) * length }
}

export function moveGradientHandle(
  type: Fill['type'],
  original: GradientTransform,
  width: number,
  height: number,
  handle: GradientHandle,
  position: Vector,
  snap = false
): GradientTransform {
  if (width <= 0 || height <= 0) return original
  const handles = gradientHandles(type, original, width, height)
  if (handle === 'center') {
    return {
      ...original,
      m02: original.m02 + (position.x - handles.center.x) / width,
      m12: original.m12 + (position.y - handles.center.y) / height
    }
  }
  if (type === 'GRADIENT_LINEAR') {
    const start = handle === 'start' ? snapDirection(handles.end, position, snap) : handles.start
    const end = handle === 'end' ? snapDirection(handles.start, position, snap) : handles.end
    if (Math.hypot(start.x - end.x, start.y - end.y) < 0.001) return original
    return {
      ...original,
      m00: (start.x - end.x) / width,
      m10: (start.y - end.y) / height,
      m01: -(start.y - end.y) / height,
      m11: (start.x - end.x) / width,
      m02: end.x / width,
      m12: end.y / height
    }
  }
  const center = handles.center
  let radiusX = handles.end
  let radiusY = handles.radiusY ?? center
  if (handle === 'radius-x') {
    radiusX = snapDirection(center, position, snap)
    const angle =
      Math.atan2(radiusX.y - center.y, radiusX.x - center.x) -
      Math.atan2(handles.end.y - center.y, handles.end.x - center.x)
    const dx = radiusY.x - center.x
    const dy = radiusY.y - center.y
    radiusY = {
      x: center.x + dx * Math.cos(angle) - dy * Math.sin(angle),
      y: center.y + dx * Math.sin(angle) + dy * Math.cos(angle)
    }
  } else if (handle === 'radius-y') {
    radiusY = snapDirection(center, position, snap)
  }
  const m00 = (2 * (radiusX.x - center.x)) / width
  const m10 = (2 * (radiusX.y - center.y)) / height
  const m01 = (2 * (radiusY.x - center.x)) / width
  const m11 = (2 * (radiusY.y - center.y)) / height
  if (Math.abs(m00 * m11 - m01 * m10) < 1e-8) return original
  return {
    m00,
    m01,
    m10,
    m11,
    m02: center.x / width - (m00 + m01) / 2,
    m12: center.y / height - (m10 + m11) / 2
  }
}
