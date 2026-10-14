import { expect, test } from 'bun:test'

import { componentScenario, documentStates } from './fixture'

for (const state of documentStates) {
  test(`${state}: add, delete, undo and redo component children without detaching instances`, async () => {
    const s = await componentScenario(state)
    try {
      expect(s.copies().map((n) => n.height)).toEqual([52, 52])
      await s.mutate(() => {
        s.graph.createNode('FRAME', s.node('Card').id, { name: 'Action', width: 80, height: 30 })
      })
      s.assertLinked()
      expect(s.copies().map((n) => n.height)).toEqual([86, 86])
      await s.mutate(() => s.graph.deleteNode(s.node('Subtext', s.node('Card')).id))
      s.assertLinked()
      expect(s.copies().map((n) => n.height)).toEqual([70, 70])
      s.editor.undo.undo()
      await s.settle()
      expect(s.copies().map((n) => n.height)).toEqual([86, 86])
      s.editor.undo.redo()
      await s.settle()
      expect(s.copies().map((n) => n.height)).toEqual([70, 70])
      await s.reopen()
      s.assertLinked()
      expect(s.copies().map((n) => n.height)).toEqual([70, 70])
    } finally {
      s.dispose()
    }
  })

  test(`${state}: repeated and different nested components stay distinct through edits and removal`, async () => {
    const s = await componentScenario(state)
    try {
      await s.mutate(() => {
        for (const name of ['Leading badge', 'Trailing badge'])
          s.graph.createInstance(s.node('Badge').id, s.node('Card').id, { name })
        s.graph.createInstance(s.node('Icon').id, s.node('Card').id, { name: 'Action icon' })
      })
      s.assertLinked()
      expect(s.copies().map((n) => n.height)).toEqual([144, 144])
      const beforeIds = s.copies().map((n) => s.node('Leading badge', n).id)
      await s.mutate(() => {
        s.graph.createNode('FRAME', s.node('Badge').id, { name: 'Dot', width: 4, height: 4 })
      })
      for (const n of s.copies()) {
        expect(s.graph.getChildren(s.node('Leading badge', n).id)).toHaveLength(2)
        expect(s.graph.getChildren(s.node('Trailing badge', n).id)).toHaveLength(2)
        expect(s.graph.getChildren(s.node('Action icon', n).id)).toHaveLength(1)
      }
      await s.mutate(() => s.graph.deleteNode(s.node('Trailing badge', s.node('Card')).id))
      s.assertLinked()
      expect(s.copies().map((n) => s.node('Leading badge', n).id)).toEqual(beforeIds)
      expect(s.copies().map((n) => n.height)).toEqual([116, 116])
      s.editor.undo.undo()
      await s.settle()
      s.assertLinked()
      expect(s.copies().map((n) => n.height)).toEqual([144, 144])
      await s.reopen()
      s.assertLinked()
      for (const n of s.copies()) expect(s.graph.getChildren(n.id)).toHaveLength(5)
    } finally {
      s.dispose()
    }
  })

  test(`${state}: reorder and reparent existing component layers without duplication`, async () => {
    const s = await componentScenario(state)
    try {
      await s.mutate(() => {
        const body = s.graph.createNode('FRAME', s.node('Card').id, {
          name: 'Body',
          width: 224,
          layoutMode: 'VERTICAL',
          primaryAxisSizing: 'HUG',
          counterAxisSizing: 'FIXED',
          itemSpacing: 4
        })
        s.graph.reparentNode(s.node('Subtext', s.node('Card')).id, body.id)
        s.graph.reparentNode(s.node('Title', s.node('Card')).id, body.id)
      })
      s.assertLinked()
      for (const n of s.copies())
        expect(s.graph.getChildren(s.node('Body', n).id).map((child) => child.name)).toEqual([
          'Subtext',
          'Title'
        ])
      s.editor.undo.undo()
      await s.settle()
      s.assertLinked()
      for (const n of s.copies())
        expect(s.graph.getChildren(n.id).map((c) => c.name)).toEqual(['Title', 'Subtext'])
      s.editor.undo.redo()
      await s.settle()
      s.assertLinked()
      await s.reopen()
      s.assertLinked()
      expect(s.copies().map((n) => n.height)).toEqual([52, 52])
    } finally {
      s.dispose()
    }
  })
}
