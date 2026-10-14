import { expect, test } from 'bun:test'

import { componentScenario, documentStates } from './fixture'

for (const state of documentStates) {
  test(`${state}: removing and restoring padding reflows the definition and its instances`, async () => {
    const s = await componentScenario('fresh')
    try {
      await s.mutate(() => {
        const card = s.node('Card')
        const content = s.graph.createNode('FRAME', card.id, {
          name: 'Content',
          width: 224,
          layoutMode: 'VERTICAL',
          primaryAxisSizing: 'HUG',
          counterAxisSizing: 'FIXED',
          layoutAlignSelf: 'STRETCH',
          itemSpacing: 4
        })
        for (const name of ['Title', 'Subtext'])
          s.graph.reparentNode(s.node(name, card).id, content.id)
      })
      if (state === 'reopened') {
        await s.reopen()
        // Retain saved bounds as older/generated files such as the reported document do.
        s.graph.preserveSourceMetadataDuring(() => {
          for (const frame of [s.node('Card'), ...s.copies()]) {
            for (const node of [frame, s.node('Content', frame)])
              s.graph.updateNode(node.id, {
                derivedLayout: { x: node.x, y: node.y, width: node.width, height: node.height }
              })
          }
        })
      }
      function assertPadding(padding: number) {
        for (const frame of [s.node('Card'), ...s.copies()]) {
          const content = s.node('Content', frame)
          expect(content.x).toBe(padding)
          expect(content.y).toBe(padding)
          expect(content.width).toBe(frame.width - padding * 2)
          expect(content.height).toBe(36)
          expect(frame.height).toBe(36 + padding * 2)
        }
        s.assertLinked()
      }
      for (const padding of [0, 12, 3, 0]) {
        s.editor.updateNodeWithUndo(s.node('Card').id, {
          paddingLeft: padding,
          paddingRight: padding,
          paddingTop: padding,
          paddingBottom: padding
        })
        await s.settle()
        assertPadding(padding)
      }
      s.editor.undo.undo()
      await s.settle()
      assertPadding(3)
      s.editor.undo.redo()
      await s.settle()
      assertPadding(0)
      await s.reopen()
      assertPadding(0)
    } finally {
      s.dispose()
    }
  })
}
