import { isNotNil } from 'es-toolkit/predicate'

import type { Vector } from '@open-pencil/scene-graph'
import {
  getAxisAlignedWorldBounds,
  getParentWorldMatrix
} from '@open-pencil/scene-graph/coordinate'
import { computeBounds } from '@open-pencil/scene-graph/geometry'
import Matrix from '@open-pencil/scene-graph/matrix'

import type { EditorContext } from '#core/editor/types'

export function createClipboardPlacementActions(ctx: EditorContext) {
  function preparePastedRoots(nodeIds: string[]) {
    for (const id of nodeIds) {
      const node = ctx.graph.getNode(id)
      if (!node) continue
      // Only the transferred roots enter a new layout context. Keep the copied
      // descendants' geometry and import metadata intact.
      ctx.graph.updateNode(id, {
        source: {
          ...node.source,
          editedFields: [...new Set([...node.source.editedFields, 'parentId'])]
        }
      })
    }
  }

  function centerNodesAt(nodeIds: string[], cx: number, cy: number) {
    const items = nodeIds.map((id) => ctx.graph.getNode(id)).filter(isNotNil)
    if (items.length === 0) return
    const bounds = computeBounds(items.map((node) => getAxisAlignedWorldBounds(node, ctx.graph)))
    const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
    for (const node of items) {
      const parent = node.parentId ? ctx.graph.getNode(node.parentId) : undefined
      const inverse = Matrix.invert(getParentWorldMatrix(parent, ctx.graph))
      if (!inverse) continue
      const before = Matrix.mapPoint(inverse, center)
      const after = Matrix.mapPoint(inverse, { x: cx, y: cy })
      ctx.graph.updateNode(node.id, {
        x: node.x + after.x - before.x,
        y: node.y + after.y - before.y
      })
    }
  }

  function getPasteCenter(parentId: string, cursorPos?: Vector): Vector {
    if (cursorPos) return cursorPos
    const parent = ctx.graph.getNode(parentId)
    if (parent && parent.type !== 'CANVAS' && parentId !== ctx.graph.rootId) {
      return Matrix.mapPoint(getParentWorldMatrix(parent, ctx.graph), {
        x: parent.width / 2,
        y: parent.height / 2
      })
    }
    const { width, height } = ctx.getViewportSize()
    return {
      x: (-ctx.state.panX + width / 2) / ctx.state.zoom,
      y: (-ctx.state.panY + height / 2) / ctx.state.zoom
    }
  }

  return { centerNodesAt, getPasteCenter, preparePastedRoots }
}
