import { expect, test } from 'bun:test'

import { componentScenario, documentStates } from './fixture'

for (const state of documentStates) {
  for (const axis of ['width', 'height'] as const) {
    for (const content of ['frame', 'text'] as const) {
      test(`${state}: ${content} inside Fill instances shrinks after growing ${axis}`, async () => {
        const s = await componentScenario('fresh')
        try {
          const mode = axis === 'width' ? 'VERTICAL' : 'HORIZONTAL'
          await s.mutate(() => {
            s.graph.updateNode(s.node('List').id, { layoutMode: mode, [axis]: 300 })
            const card = s.node('Card')
            for (const child of s.graph.getChildren(card.id)) s.graph.deleteNode(child.id)
            s.graph.updateNode(card.id, {
              layoutMode: mode,
              primaryAxisSizing: 'HUG',
              counterAxisSizing: 'HUG'
            })
            const body = s.graph.createNode(content === 'frame' ? 'FRAME' : 'TEXT', card.id, {
              name: 'Content',
              width: 224,
              height: 224,
              layoutMode: content === 'frame' ? mode : 'NONE',
              primaryAxisSizing: 'HUG',
              counterAxisSizing: 'FIXED',
              layoutAlignSelf: 'STRETCH',
              text: 'Settings',
              textAutoResize: 'NONE'
            })
            if (content === 'frame')
              s.graph.createNode('FRAME', body.id, {
                name: 'Inner',
                width: 40,
                height: 40,
                layoutAlignSelf: 'STRETCH'
              })
          })
          if (state === 'reopened') await s.reopen()
          const sourceSize = s.node('Card')[axis]
          function assertSize(size: number) {
            for (const instance of s.copies()) {
              expect(instance[axis]).toBe(size)
              const body = s.node('Content', instance)
              expect(body[axis]).toBe(size - 16)
              if (content === 'frame') expect(s.node('Inner', body)[axis]).toBe(size - 16)
            }
            expect(s.node('Card')[axis]).toBe(sourceSize)
            s.assertLinked()
          }
          for (const size of [500, 200, 400, 160, 300]) {
            s.editor.updateNodeWithUndo(s.node('List').id, { [axis]: size })
            await s.settle()
            assertSize(size)
          }
          s.editor.undo.undo()
          await s.settle()
          assertSize(160)
          s.editor.undo.redo()
          await s.settle()
          assertSize(300)
          await s.reopen()
          assertSize(300)
          s.editor.updateNode(s.node('List').id, { [axis]: 200 })
          await s.settle()
          assertSize(200)

          // A real minimum remains authoritative, even when it intentionally overflows.
          const minAxis = axis === 'width' ? 'minWidth' : 'minHeight'
          await s.mutate(() => {
            s.graph.updateNode(s.node('Content', s.node('Card')).id, { [minAxis]: 250 })
          })
          s.editor.updateNode(s.node('List').id, { [axis]: 160 })
          await s.settle()
          for (const instance of s.copies()) {
            expect(instance[axis]).toBe(160)
            expect(s.node('Content', instance)[axis]).toBe(250)
          }
        } finally {
          s.dispose()
        }
      })
    }
  }
}
