import { expect, test } from 'bun:test'

import { computeAllLayouts } from '#core/layout'

import { kinds, savedLayoutScenario } from './fixture'

for (const kind of kinds) {
  test(`${kind}: import normalization preserves saved offsets until an actual layout edit`, async () => {
    const s = await savedLayoutScenario(kind, 'retained')
    try {
      s.graph.preserveSourceMetadataDuring(() => {
        const frame = s.target()
        const footer = s.node('Footer')
        s.graph.updateNode(frame.id, {
          source: { ...frame.source, editedFields: ['width', 'height', 'fontSize'] }
        })
        s.graph.updateNode(footer.id, {
          x: 17,
          y: 81,
          derivedLayout: { x: 17, y: 81, width: 80, height: 16 }
        })
      })
      computeAllLayouts(s.graph)
      expect(s.node('Footer')).toMatchObject({ x: 17, y: 81 })
      await s.edit(s.target().id, { itemSpacing: 20 })
      s.assertFlow(20)
      await s.reopen()
      s.assertFlow(20)
    } finally {
      s.dispose()
    }
  })

  test(`${kind}: a preview returning to its original value leaves no edit`, async () => {
    const s = await savedLayoutScenario(kind, 'retained')
    try {
      const before = structuredClone(s.target())
      const preview = s.editor.beginNodePreview('Gap')
      preview.update(s.target().id, { itemSpacing: 20 })
      preview.update(s.target().id, { itemSpacing: 4 })
      preview.commit()
      await s.settle()
      expect(s.editor.undo.canUndo).toBe(false)
      expect(s.target()).toEqual(before)
    } finally {
      s.dispose()
    }
  })
  test(`${kind}: untouched and appearance-only changes preserve saved layout`, async () => {
    const s = await savedLayoutScenario(kind, 'retained')
    try {
      // A layout the importer preserved, even though its offsets differ from Yoga's defaults.
      s.graph.preserveSourceMetadataDuring(() => {
        const footer = s.node('Footer')
        s.graph.updateNode(footer.id, {
          x: 17,
          y: 81,
          derivedLayout: { x: 17, y: 81, width: 80, height: 16 }
        })
      })
      const before = s.graph.getChildren(s.target().id).map((n) => ({
        x: n.x,
        y: n.y,
        width: n.width,
        height: n.height,
        derivedLayout: structuredClone(n.derivedLayout)
      }))
      computeAllLayouts(s.graph)
      await s.edit(s.target().id, { opacity: 0.5 })
      expect(
        s.graph.getChildren(s.target().id).map((n) => ({
          x: n.x,
          y: n.y,
          width: n.width,
          height: n.height,
          derivedLayout: n.derivedLayout
        }))
      ).toEqual(before)
    } finally {
      s.dispose()
    }
  })
  test(`${kind}: canceling a preview preserves saved geometry on subsequent layout`, async () => {
    const s = await savedLayoutScenario(kind, 'retained')
    try {
      const before = [...s.graph.getAllNodes()].map((n) => ({
        id: n.id,
        source: structuredClone(n.source),
        derivedLayout: structuredClone(n.derivedLayout),
        x: n.x,
        y: n.y,
        width: n.width,
        height: n.height
      }))
      const preview = s.editor.beginNodePreview('Padding')
      preview.update(s.target().id, {
        paddingLeft: 0,
        paddingRight: 0,
        paddingTop: 0,
        paddingBottom: 0
      })
      preview.cancel()
      computeAllLayouts(s.graph)
      expect(
        [...s.graph.getAllNodes()].map((n) => ({
          id: n.id,
          source: n.source,
          derivedLayout: n.derivedLayout,
          x: n.x,
          y: n.y,
          width: n.width,
          height: n.height
        }))
      ).toEqual(before)
    } finally {
      s.dispose()
    }
  })
  test(`${kind}: committed previews support undo, redo and saving`, async () => {
    const s = await savedLayoutScenario(kind, 'retained')
    try {
      const preview = s.editor.beginNodePreview('Padding')
      preview.update(s.target().id, {
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: 12,
        paddingBottom: 12
      })
      preview.commit()
      await s.settle()
      s.assertFlow(4, 12)
      s.editor.undo.undo()
      await s.settle()
      s.assertFlow()
      s.editor.undo.redo()
      await s.settle()
      s.assertFlow(4, 12)
      await s.reopen()
      s.assertFlow(4, 12)
    } finally {
      s.dispose()
    }
  })
  test(`${kind}: minimum height and excluded contents keep their intended sizing`, async () => {
    const s = await savedLayoutScenario(kind, 'retained')
    try {
      await s.edit(s.target().id, { minHeight: 120 })
      for (const n of s.affected()) expect(n.height).toBe(120)
      await s.edit(s.target().id, { minHeight: null })
      s.assertFlow()
      await s.edit(s.node('Body').id, { layoutPositioning: 'ABSOLUTE' })
      for (const n of s.affected()) {
        expect(n.height).toBe(32)
        expect(s.node('Body', n).height).toBe(36)
      }
      await s.edit(s.node('Body').id, { layoutPositioning: 'AUTO' })
      s.assertFlow()
    } finally {
      s.dispose()
    }
  })
}

test('several edits invalidate one connected saved tree without touching another tree', async () => {
  const s = await savedLayoutScenario('frame', 'retained')
  try {
    const other = s.graph.createNode('FRAME', s.editor.state.currentPageId, {
      name: 'Unrelated',
      width: 100,
      height: 100,
      layoutMode: 'VERTICAL'
    })
    computeAllLayouts(s.graph)
    s.retainGeometry()
    const before = structuredClone(other)
    let released = 0
    const stop = s.graph.onNodeEvents({
      updated: (id, changes) => {
        if (id === s.target().id && 'derivedLayout' in changes && changes.derivedLayout === null)
          released++
      }
    })
    try {
      await s.editor.runMutationWithLayout(() => {
        s.graph.updateNode(s.target().id, { itemSpacing: 20 })
        s.graph.updateNode(s.node('Footer').id, { height: 40 })
        s.graph.updateNode(s.node('Title', s.node('Body')).id, { text: 'A'.repeat(80) })
      })
      s.assertFlow(20, 8, 76, 40)
      expect(released).toBe(1)
      expect(other).toEqual(before)
    } finally {
      stop()
    }
  } finally {
    s.dispose()
  }
})
