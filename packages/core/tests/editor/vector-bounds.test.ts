import { expect, test } from 'bun:test'

import { parseSVGPath } from '@open-pencil/scene-graph/parse-path'
import { computeAccurateBounds } from '@open-pencil/scene-graph/vector-network'

import { createEditor } from '#core/editor'
import { exportFigFile, parseFigFile } from '#core/io'

test('path changes capture their implicit bounds for undo, redo and previews', () => {
  const editor = createEditor()
  try {
    const node = editor.graph.createNode('VECTOR', editor.state.currentPageId, {
      x: 20,
      y: 30,
      vectorNetwork: parseSVGPath('M0 0 H40 V20 H0 Z')
    })
    const before = structuredClone(node)
    editor.updateNodeWithUndo(node.id, { vectorNetwork: parseSVGPath('M-10 -5 H80 V40 H-10 Z') })
    expect(node).toMatchObject({ x: 10, y: 25, width: 90, height: 45 })
    editor.undoAction()
    expect(node).toMatchObject({
      x: 20,
      y: 30,
      width: 40,
      height: 20,
      vectorNetwork: before.vectorNetwork
    })
    editor.redoAction()
    expect(node).toMatchObject({ x: 10, y: 25, width: 90, height: 45 })
    const committed = structuredClone(node)
    const preview = editor.beginNodePreview('Path')
    preview.update(node.id, { vectorNetwork: parseSVGPath('M10 10 H20 V20 H10 Z') })
    expect(node).toMatchObject({ x: 20, y: 35, width: 10, height: 10 })
    preview.cancel()
    expect(node).toEqual(committed)
  } finally {
    editor.dispose()
  }
})

test('fitting and resizing vector geometry retain its shared paint styles', () => {
  const editor = createEditor()
  try {
    const node = editor.graph.createNode('VECTOR', editor.state.currentPageId, {
      fillStyleId: 'fill-style',
      strokeStyleId: 'stroke-style',
      vectorNetwork: parseSVGPath('M0 0 H40 V20 H0 Z'),
      strokes: [
        {
          type: 'SOLID',
          color: { r: 0, g: 0, b: 0, a: 1 },
          visible: true,
          opacity: 1,
          weight: 2,
          align: 'CENTER'
        }
      ]
    })
    editor.updateNodeWithUndo(node.id, { vectorNetwork: parseSVGPath('M-10 -5 H80 V40 H-10 Z') })
    expect(node).toMatchObject({ fillStyleId: 'fill-style', strokeStyleId: 'stroke-style' })
    editor.updateNodeWithUndo(node.id, { width: 180 })
    expect(node).toMatchObject({ fillStyleId: 'fill-style', strokeStyleId: 'stroke-style' })
  } finally {
    editor.dispose()
  }
})

test('opening an older SVG fits paths while preserving the SVG frame and save/reopen placement', async () => {
  const editor = createEditor()
  try {
    const frame = editor.graph.createNode('FRAME', editor.state.currentPageId, {
      name: 'Artwork',
      width: 1004,
      height: 1004
    })
    const path = editor.graph.createNode('VECTOR', frame.id, { name: 'Coverage' })
    // The old SVG generator stored the viewBox as every child path's bounds.
    editor.graph.preserveSourceMetadataDuring(() =>
      editor.graph.updateNode(path.id, {
        width: 1004,
        height: 1004,
        vectorNetwork: parseSVGPath('M153 400 L292 400 L153 578 Z')
      })
    )
    const reopened = await parseFigFile((await exportFigFile(editor.graph)).slice().buffer)
    const restoredFrame = [...reopened.getAllNodes()].find((n) => n.name === 'Artwork')
    const restored = [...reopened.getAllNodes()].find((n) => n.name === 'Coverage')
    expect(restoredFrame).toMatchObject({ width: 1004, height: 1004 })
    expect(restored).toMatchObject({ x: 153, y: 400, width: 139, height: 178 })
    if (!restored?.vectorNetwork) throw new Error('Missing path')
    expect(computeAccurateBounds(restored.vectorNetwork)).toEqual({
      x: 0,
      y: 0,
      width: 139,
      height: 178
    })
    reopened.updateNode(restored.id, { opacity: 0.5 })
    const again = await parseFigFile((await exportFigFile(reopened)).slice().buffer)
    expect([...again.getAllNodes()].find((n) => n.name === 'Coverage')).toMatchObject({
      x: 153,
      y: 400,
      width: 139,
      height: 178,
      opacity: 0.5
    })
  } finally {
    editor.dispose()
  }
})
