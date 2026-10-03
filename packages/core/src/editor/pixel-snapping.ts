import type { SceneNode } from '@open-pencil/scene-graph'

/** Quantize manual geometry, before layout has the final say over its computed values. */
export function snapGeometryChanges<T extends Partial<SceneNode>>(changes: T, enabled: boolean): T {
  if (!enabled) return changes
  const snapped = { ...changes }
  for (const key of ['x', 'y', 'width', 'height'] as const) {
    const value = changes[key]
    if (value !== undefined && Number.isFinite(value)) snapped[key] = Math.round(value)
  }
  return snapped
}
