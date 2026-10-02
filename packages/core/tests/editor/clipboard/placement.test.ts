import { describe, expect, test } from 'bun:test'

import { buildOpenPencilClipboardHTML } from '@open-pencil/core/clipboard'
import { createEditor, type Editor } from '@open-pencil/core/editor'
import type { SceneNode, Vector } from '@open-pencil/scene-graph'
import { getAxisAlignedWorldBounds, getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import Matrix from '@open-pencil/scene-graph/matrix'

type Delivery = 'snapshot' | 'legacy-html' | 'figma-html'

async function clipboard() {
  const source = createEditor()
  const frame = source.graph.createNode('FRAME', source.state.currentPageId, {
    x: 2300,
    y: -1800,
    width: 80,
    height: 60,
    name: 'Copied frame'
  })
  const child = source.graph.createNode('FRAME', frame.id, {
    x: 7,
    y: 11,
    width: 30,
    height: 20,
    name: 'Inner frame'
  })
  source.graph.createNode('RECTANGLE', child.id, { x: 3, y: 4, width: 10, height: 8 })
  source.select([frame.id])
  const payload = await source.prepareCopy()
  const legacy = buildOpenPencilClipboardHTML([frame], source.graph)
  source.dispose()
  return async (editor: Editor, delivery: Delivery, point?: Vector) => {
    if (delivery === 'snapshot') {
      if (!payload.snapshot) throw new Error('Missing snapshot')
      await editor.pasteSnapshot(payload.snapshot, point)
    } else await editor.pasteFromHTML(delivery === 'legacy-html' ? legacy : payload.html, point)
    const pasted = editor.graph.getNode([...editor.state.selectedIds][0])
    if (!pasted) throw new Error('Missing pasted root')
    return pasted
  }
}

function checkChildren(editor: Editor, root: SceneNode) {
  const [child] = editor.graph.getChildren(root.id)
  const [grandchild] = editor.graph.getChildren(child.id)
  expect(child).toMatchObject({ x: 7, y: 11, width: 30, height: 20 })
  expect(grandchild).toMatchObject({ x: 3, y: 4, width: 10, height: 8 })
}

describe('paste placement', () => {
  for (const delivery of ['snapshot', 'legacy-html', 'figma-html'] as const) {
    test(`${delivery}: centers in a nested, rotated, flipped container without moving descendants`, async () => {
      const paste = await clipboard()
      const editor = createEditor()
      try {
        const outer = editor.graph.createNode('FRAME', editor.state.currentPageId, {
          x: -1200,
          y: 1800,
          width: 600,
          height: 500,
          rotation: 17
        })
        const target = editor.graph.createNode('FRAME', outer.id, {
          x: 120,
          y: 90,
          width: 300,
          height: 200,
          rotation: 90,
          flipX: true
        })
        editor.select([target.id])
        const pasted = await paste(editor, delivery)
        expect(pasted.parentId).toBe(target.id)
        expect(pasted.x).toBeCloseTo(110, 5)
        expect(pasted.y).toBeCloseTo(70, 5)
        checkChildren(editor, pasted)
        const id = pasted.id
        editor.undoAction()
        expect(editor.graph.getNode(id)).toBeUndefined()
        expect(target.childIds).toEqual([])
        editor.redoAction()
        const restored = editor.graph.getNode(id)
        if (!restored) throw new Error('Missing restored paste')
        expect(restored.x).toBeCloseTo(110, 5)
        expect(restored.y).toBeCloseTo(70, 5)
        checkChildren(editor, restored)
      } finally {
        editor.dispose()
      }
    })

    test(`${delivery}: explicit canvas coordinates convert into the target's local coordinates`, async () => {
      const paste = await clipboard()
      const editor = createEditor()
      try {
        const target = editor.graph.createNode('FRAME', editor.state.currentPageId, {
          x: 3000,
          y: -2000,
          width: 300,
          height: 200,
          rotation: 32,
          flipY: true
        })
        editor.select([target.id])
        const point = Matrix.mapPoint(getWorldMatrix(target, editor.graph), { x: 80, y: 60 })
        const pasted = await paste(editor, delivery, point)
        const bounds = getAxisAlignedWorldBounds(pasted, editor.graph)
        expect(bounds.x + bounds.width / 2).toBeCloseTo(point.x, 5)
        expect(bounds.y + bounds.height / 2).toBeCloseTo(point.y, 5)
        expect(pasted.x).toBeCloseTo(40, 5)
        expect(pasted.y).toBeCloseTo(30, 5)
        checkChildren(editor, pasted)
      } finally {
        editor.dispose()
      }
    })

    test(`${delivery}: the destination's auto layout positions the pasted root`, async () => {
      const paste = await clipboard()
      const editor = createEditor()
      try {
        const target = editor.graph.createNode('FRAME', editor.state.currentPageId, {
          x: 500,
          y: 700,
          width: 300,
          height: 200,
          layoutMode: 'HORIZONTAL',
          primaryAxisSizing: 'FIXED',
          counterAxisSizing: 'FIXED',
          itemSpacing: 12,
          paddingLeft: 10,
          paddingTop: 8
        })
        editor.graph.applyImportedStateDuring(() =>
          editor.graph.updateNode(target.id, {
            source: { ...target.source, format: 'fig' }
          })
        )
        editor.graph.createNode('RECTANGLE', target.id, { width: 40, height: 20 })
        editor.select([target.id])
        const pasted = await paste(editor, delivery)
        expect(pasted).toMatchObject({ x: 62, y: 8, width: 80, height: 60 })
        checkChildren(editor, pasted)
      } finally {
        editor.dispose()
      }
    })
  }

  test('multi-object paste keeps the selection’s relative spacing', async () => {
    const source = createEditor()
    const editor = createEditor()
    try {
      const first = source.graph.createNode('RECTANGLE', source.state.currentPageId, {
        x: 1000,
        y: 1000,
        width: 20,
        height: 20
      })
      const second = source.graph.createNode('RECTANGLE', source.state.currentPageId, {
        x: 1080,
        y: 1030,
        width: 40,
        height: 40
      })
      source.select([first.id, second.id])
      const payload = await source.prepareCopy()
      if (!payload.snapshot) throw new Error('Missing snapshot')
      const target = editor.graph.createNode('FRAME', editor.state.currentPageId, {
        x: 4000,
        y: 2000,
        width: 300,
        height: 200
      })
      editor.select([target.id])
      await editor.pasteSnapshot(payload.snapshot)
      const [a, b] = editor.graph.getChildren(target.id)
      expect(a).toMatchObject({ x: 90, y: 65 })
      expect(b).toMatchObject({ x: 170, y: 95 })
    } finally {
      source.dispose()
      editor.dispose()
    }
  })
})
