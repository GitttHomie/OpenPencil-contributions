import { getNodeLocalMatrix } from '../coordinate'
import { copyFill, transformGeometryPaths } from '../copy'
import Matrix from '../matrix'
import { scaledGeometryChanges } from '../resize'
import type { Fill, SceneNode } from '../types'
import { computeAccurateBounds } from './bounds'
import { regenerateFillGeometry } from './fill-geometry'
import { transformVectorNetwork, vectorNetworksEqual } from './index'

function rebasePaint<T extends Fill>(
  paint: T,
  node: SceneNode,
  x: number,
  y: number,
  width: number,
  height: number
): T {
  const result = copyFill(paint)
  const t = paint.gradientTransform
  if (t && width > 0 && height > 0) {
    result.gradientTransform = {
      m00: (t.m00 * node.width) / width,
      m01: (t.m01 * node.width) / width,
      m02: (t.m02 * node.width - x) / width,
      m10: (t.m10 * node.height) / height,
      m11: (t.m11 * node.height) / height,
      m12: (t.m12 * node.height - y) / height
    }
  }
  const image = paint.imageTransform
  if (image && node.width > 0 && node.height > 0) {
    result.imageTransform = {
      m00: (image.m00 * width) / node.width,
      m01: (image.m01 * height) / node.height,
      m02: image.m02 + (image.m00 * x) / node.width + (image.m01 * y) / node.height,
      m10: (image.m10 * width) / node.width,
      m11: (image.m11 * height) / node.height,
      m12: image.m12 + (image.m10 * x) / node.width + (image.m11 * y) / node.height
    }
  }
  return result
}

/** Fit a vector's coordinate system to its curves without moving those curves in its parent. */
export function fittedVectorChanges(node: SceneNode): Partial<SceneNode> {
  const network = node.vectorNetwork
  if (node.type !== 'VECTOR' || !network) return {}
  if (network.vertices.length === 0) return node.width || node.height ? { width: 0, height: 0 } : {}
  const bounds = computeAccurateBounds(network)
  if (![bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite)) return {}
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-7
  if (
    near(bounds.x, 0) &&
    near(bounds.y, 0) &&
    near(bounds.width, node.width) &&
    near(bounds.height, node.height)
  )
    return {}
  const origin = Matrix.mapPoints(getNodeLocalMatrix(node), [bounds.x, bounds.y])
  const nextOrigin = Matrix.mapPoints(
    getNodeLocalMatrix({ ...node, width: bounds.width, height: bounds.height }, { x: 0, y: 0 }),
    [0, 0]
  )
  return {
    x: origin[0] - nextOrigin[0],
    y: origin[1] - nextOrigin[1],
    width: bounds.width,
    height: bounds.height,
    vectorNetwork: transformVectorNetwork([1, 0, -bounds.x, 0, 1, -bounds.y, 0, 0, 1], network),
    fillGeometry: transformGeometryPaths(node.fillGeometry, 1, 0, 0, 1, -bounds.x, -bounds.y).map(
      (path) => ({
        ...path,
        ...(path.fills && {
          fills: path.fills.map((fill) =>
            rebasePaint(fill, node, bounds.x, bounds.y, bounds.width, bounds.height)
          )
        })
      })
    ),
    strokeGeometry: transformGeometryPaths(node.strokeGeometry, 1, 0, 0, 1, -bounds.x, -bounds.y),
    fills: node.fills.map((fill) =>
      rebasePaint(fill, node, bounds.x, bounds.y, bounds.width, bounds.height)
    ),
    strokes: node.strokes.map((stroke) =>
      rebasePaint(stroke, node, bounds.x, bounds.y, bounds.width, bounds.height)
    ),
    // These paint changes preserve the artwork; they are not manual style overrides.
    fillStyleId: node.fillStyleId,
    strokeStyleId: node.strokeStyleId,
    derivedLayout: null
  }
}

/** A size edit scales the path; a path edit determines the size. */
export function vectorGeometryChanges(
  node: SceneNode,
  changes: Partial<SceneNode>
): Partial<SceneNode> {
  if ((changes.type ?? node.type) !== 'VECTOR') return changes
  if (!changes.vectorNetwork && changes.width === undefined && changes.height === undefined)
    return changes
  const resized =
    !changes.vectorNetwork && node.vectorNetwork
      ? scaledGeometryChanges(
          node,
          node.width,
          node.height,
          changes.width ?? node.width,
          changes.height ?? node.height
        )
      : {}
  const paths =
    changes.vectorNetwork &&
    (!node.vectorNetwork || !vectorNetworksEqual(node.vectorNetwork, changes.vectorNetwork))
      ? {
          fillGeometry:
            changes.fillGeometry ??
            regenerateFillGeometry(changes.vectorNetwork, node.fillGeometry),
          strokeGeometry: changes.strokeGeometry ?? []
        }
      : {}
  const next = { ...node, ...resized, ...paths, ...changes }
  return {
    ...resized,
    ...(resized.strokes && !changes.strokes && { strokeStyleId: node.strokeStyleId }),
    ...paths,
    ...changes,
    ...fittedVectorChanges(next)
  }
}
