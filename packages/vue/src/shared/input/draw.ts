import { DEFAULT_TEXT_HEIGHT, DEFAULT_TEXT_WIDTH } from '@open-pencil/core/constants'
import type { Editor } from '@open-pencil/core/editor'
import type { SceneNode } from '@open-pencil/scene-graph'

import { computeAutoLayoutIndicatorForFrame } from '#vue/shared/input/auto-layout'
import { TOOL_TO_NODE } from '#vue/shared/input/types'
import type { DragDraw, DragState } from '#vue/shared/input/types'

function attachDraw(editor: Editor, nodeId: string, parent: SceneNode, x: number, y: number) {
  if (parent.layoutMode !== 'NONE') {
    computeAutoLayoutIndicatorForFrame(parent, x, y, editor, new Set([nodeId]))
    const index = editor.state.layoutInsertIndicator?.index ?? parent.childIds.length
    editor.reorderInAutoLayout(nodeId, parent.id, index)
  } else {
    editor.reorderChildWithUndo(nodeId, parent.id, parent.childIds.length)
  }
}

export function startTextDraw(
  cx: number,
  cy: number,
  editor: Editor,
  setDrag: (d: DragState) => void
) {
  editor.undo.beginBatch('Create text')
  const nodeId = editor.createShape('TEXT', cx, cy, 0, 0)
  editor.graph.updateNode(nodeId, { text: '' })
  editor.select([nodeId])
  setDrag(createDraw(editor, nodeId, cx, cy))
}

export function startShapeDraw(
  cx: number,
  cy: number,
  editor: Editor,
  setDrag: (d: DragState) => void
) {
  const nodeType = TOOL_TO_NODE[editor.state.activeTool]
  if (!nodeType) return

  editor.undo.beginBatch('Create shape')
  const nodeId = editor.createShape(nodeType, cx, cy, 0, 0)
  editor.select([nodeId])
  setDrag(createDraw(editor, nodeId, cx, cy))
}

export function handleDrawMove(d: DragDraw, cx: number, cy: number, shiftKey: boolean) {
  let w = cx - d.startX
  let h = cy - d.startY

  if (shiftKey) {
    const size = Math.max(Math.abs(w), Math.abs(h))
    w = Math.sign(w) * size
    h = Math.sign(h) * size
  }

  d.update({
    x: w < 0 ? d.startX + w : d.startX,
    y: h < 0 ? d.startY + h : d.startY,
    width: Math.abs(w),
    height: Math.abs(h)
  })
}

function createDraw(editor: Editor, nodeId: string, startX: number, startY: number): DragDraw {
  const graph = editor.graph
  const start = editor.snapGeometry({ x: startX, y: startY })
  // Keep the draft in page coordinates until release, so layout cannot fight drawing.
  let parent = graph.hitTestFrame(startX, startY, new Set([nodeId]), editor.state.currentPageId)
  if (graph.getNode(nodeId)?.type === 'SECTION') {
    while (parent && parent.type !== 'SECTION' && parent.type !== 'CANVAS') {
      parent = parent.parentId ? (graph.getNode(parent.parentId) ?? null) : null
    }
  }
  const preview = editor.beginNodePreview('Draw dimensions')
  let finished = false
  editor.setDropTarget(parent?.id ?? null)

  function cancel() {
    if (finished) return
    finished = true
    preview.cancel()
    editor.setDropTarget(null)
    editor.setLayoutInsertIndicator(null)
    // Never replay an old document's creation undo against a replacement graph.
    if (editor.graph === graph) editor.undo.rollbackBatch()
  }

  function commit() {
    if (finished) return
    if (preview.closed || editor.graph !== graph) {
      cancel()
      return
    }
    finished = true
    const node = graph.getNode(nodeId)
    try {
      if (node?.type === 'TEXT') {
        const isPointText = node.width < 2 && node.height < 2
        preview.update(nodeId, {
          width: isPointText ? DEFAULT_TEXT_WIDTH : node.width,
          height: isPointText ? DEFAULT_TEXT_HEIGHT : node.height,
          textAutoResize: isPointText ? 'WIDTH_AND_HEIGHT' : 'NONE'
        })
      } else if (node && node.width < 2 && node.height < 2) {
        preview.update(nodeId, { width: 100, height: 100 })
      }
      preview.commit()
      if (node && parent) attachDraw(editor, nodeId, parent, startX, startY)
      if (node?.type === 'SECTION') editor.adoptNodesIntoSection(node.id)
      editor.undo.commitBatch()
    } catch (error) {
      preview.cancel()
      editor.undo.rollbackBatch()
      throw error
    }
    editor.setDropTarget(null)
    editor.setLayoutInsertIndicator(null)
    editor.setTool('SELECT')
    if (node?.type === 'TEXT') editor.startTextEditing(node.id)
  }

  // Creation itself is already an edit: avoid rebuilding the backing on the first held frame.
  try {
    preview.update(nodeId, start)
  } catch (error) {
    cancel()
    throw error
  }

  return {
    type: 'draw',
    startX: start.x,
    startY: start.y,
    nodeId,
    update: (changes) => {
      if (!finished) preview.update(nodeId, editor.snapGeometry(changes))
    },
    commit,
    cancel
  }
}
