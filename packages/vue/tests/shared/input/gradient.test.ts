import { expect, test } from 'bun:test'
import { createEditor, editedGradientLayout } from '@open-pencil/core/editor'
import type { Fill } from '@open-pencil/scene-graph'
import { tryStartGradientDrag } from '#vue/shared/input/gradient'
import type { DragGradient } from '#vue/shared/input/types'

const gradient: Fill = {
  type: 'GRADIENT_LINEAR', color: { r: 0, g: 0, b: 0, a: 1 }, visible: true, opacity: 1,
  gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
  gradientStops: [
    { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
    { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } }
  ]
}

for (const paint of ['fills', 'strokes'] as const) {
  for (const type of ['GRADIENT_LINEAR', 'GRADIENT_RADIAL', 'GRADIENT_ANGULAR', 'GRADIENT_DIAMOND'] as const) {
    test(`${type} ${paint} handles preview live, preserve other paints and geometry, undo and cancel`, () => {
      const editor = createEditor()
      try {
        const node = editor.graph.createNode('FRAME', editor.state.currentPageId, {
          width: 200, height: 100, x: 50, y: 80,
          fills: [structuredClone(gradient), { ...structuredClone(gradient), type }],
          strokes: [
            { ...structuredClone(gradient), type: 'SOLID', weight: 2, align: 'OUTSIDE' },
            { ...structuredClone(gradient), type, weight: 8, align: 'INSIDE', opacity: 0.7 }
          ]
        })
        editor.select([node.id])
        editor.state.gradientEdit = { nodeId: node.id, paint, index: 1, stop: 0 }
        const before = structuredClone({ fills: node.fills, strokes: node.strokes })
        function begin() {
          const layout = editedGradientLayout(editor.graph, editor.state.gradientEdit, editor.state)
          const point = layout?.dots.find((dot) => dot.handle === 'center')?.point
          if (!point) throw new Error('Missing gradient center')
          const active: { drag?: DragGradient } = {}
          expect(tryStartGradientDrag(editor, point.x, point.y, (drag) => {
            if (drag.type === 'gradient') active.drag = drag
          })).toBe(true)
          const drag = active.drag
          if (!drag) throw new Error('Missing drag')
          return { drag, point }
        }
        const { drag, point } = begin()
        drag.update(point.x + 40, point.y + 20, false, true)
        const changed = structuredClone(node[paint])
        expect(changed[1].gradientTransform).not.toEqual(before[paint][1].gradientTransform)
        drag.commit()
        expect(node[paint]).toEqual(changed)
        expect(node[paint][0]).toEqual(before[paint][0])
        expect(node[paint === 'fills' ? 'strokes' : 'fills']).toEqual(before[paint === 'fills' ? 'strokes' : 'fills'])
        expect(node).toMatchObject({ x: 50, y: 80, width: 200, height: 100 })
        if (paint === 'strokes') expect(node.strokes[1]).toMatchObject({ weight: 8, align: 'INSIDE', opacity: 0.7 })
        editor.undoAction()
        expect(node[paint]).toEqual(before[paint])
        editor.redoAction()
        expect(node[paint]).toEqual(changed)
        editor.undoAction()
        const cancelled = begin()
        cancelled.drag.update(cancelled.point.x + 70, cancelled.point.y + 30, false)
        cancelled.drag.cancel()
        cancelled.drag.update(500, 500, false)
        cancelled.drag.commit()
        expect(node[paint]).toEqual(before[paint])
        expect(editor.state.gradientEdit?.guides).toEqual([])
      } finally { editor.dispose() }
    })
  }
}
