import { expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import { collectResizeDescendants } from '@open-pencil/scene-graph/resize'

import { applyResize, commitResizePreview } from '#vue/shared/input/resize'
import type { DragResize } from '#vue/shared/input/types'

for (const mode of ['HORIZONTAL', 'VERTICAL'] as const) {
  for (const fraction of [0, 0.5]) {
    test(`${mode}, fraction ${fraction}: nested Hug frames keep badge anchors through drag, commit and undo`, () => {
      const editor = createEditor()
      try {
        const root = editor.graph.createNode('FRAME', editor.state.currentPageId, {
          width: 100,
          height: 100
        })
        const hug = editor.graph.createNode('FRAME', root.id, {
          width: 50 + fraction,
          height: 30 + fraction,
          layoutMode: mode,
          primaryAxisSizing: 'HUG',
          counterAxisSizing: 'HUG',
          horizontalConstraint: 'STRETCH',
          verticalConstraint: 'STRETCH'
        })
        editor.graph.createNode('FRAME', hug.id, { width: 50 + fraction, height: 30 + fraction })
        const badge = editor.graph.createNode('FRAME', hug.id, {
          x: 45 + fraction,
          y: -5 - fraction,
          width: 10,
          height: 10,
          layoutPositioning: 'ABSOLUTE',
          horizontalConstraint: 'MAX',
          verticalConstraint: 'MIN'
        })
        editor.runLayoutForNode(root.id)
        const drag: DragResize = {
          type: 'resize',
          handle: 'se',
          startX: 0,
          startY: 0,
          nodeId: root.id,
          origRect: { x: 0, y: 0, width: 100, height: 100 },
          origVectorNetwork: null,
          origFillGeometry: [],
          origStrokeGeometry: [],
          origDerivedTextGlyphs: null,
          origStrokes: [],
          origTextPathData: null,
          origTextPathBox: null,
          origChildren: collectResizeDescendants(editor.graph, root.id)
        }
        const check = () => {
          expect(hug).toMatchObject({ width: 50 + fraction, height: 30 + fraction })
          expect(badge).toMatchObject({ x: 45 + fraction, y: -5 - fraction, width: 10, height: 10 })
        }
        for (const delta of [50, 100, 25, 100]) {
          applyResize(drag, delta, delta / 2, false, editor)
          check()
        }
        commitResizePreview(drag, editor)
        check()
        expect(root.width).toBe(200)
        editor.undoAction()
        check()
        expect(root.width).toBe(100)
        editor.redoAction()
        check()
        expect(root.width).toBe(200)
      } finally {
        editor.dispose()
      }
    })
  }
}
