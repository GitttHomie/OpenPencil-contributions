import { expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { createEditor } from '#core/editor'
import { exportFigFile, parseFigFile } from '#core/io'
import { initCodec } from '#core/kiwi'

for (const state of ['fresh', 'reopened'] as const) {
  for (const direction of ['HORIZONTAL', 'VERTICAL'] as const) {
    for (const fillAxis of ['main', 'cross'] as const) {
      test(`${state}: ordinary frames follow ${direction} ${fillAxis}-axis Fill through repeated resizing`, async () => {
        let editor = createEditor()
        try {
          const axis = (direction === 'HORIZONTAL') === (fillAxis === 'main') ? 'width' : 'height'
          const root = editor.graph.createNode('FRAME', editor.state.currentPageId, {
            name: 'Screen',
            width: 300,
            height: 300,
            layoutMode: direction,
            primaryAxisSizing: 'FIXED',
            counterAxisSizing: 'FIXED'
          })
          for (const layoutMode of ['NONE', direction] as const) {
            const bar = editor.graph.createNode('FRAME', root.id, {
              name: layoutMode,
              width: 100,
              height: 100,
              layoutMode,
              primaryAxisSizing: layoutMode === 'NONE' ? 'FIXED' : 'HUG',
              counterAxisSizing: layoutMode === 'NONE' ? 'FIXED' : 'HUG',
              layoutGrow: fillAxis === 'main' ? 1 : 0,
              layoutAlignSelf: fillAxis === 'cross' ? 'STRETCH' : 'AUTO'
            })
            editor.graph.createNode('FRAME', bar.id, { width: 40, height: 40 })
          }
          editor.runLayoutForNode(root.id)
          async function reopen() {
            await initCodec()
            const graph = await parseFigFile((await exportFigFile(editor.graph)).slice().buffer)
            editor.dispose()
            editor = createEditor({ graph })
          }
          if (state === 'reopened') await reopen()
          function screen() {
            return expectDefined([...editor.graph.getAllNodes()].find((n) => n.name === 'Screen'))
          }
          function assertSize(size: number) {
            expect(screen()[axis]).toBe(size)
            for (const [index, child] of editor.graph.getChildren(screen().id).entries()) {
              expect(child[axis]).toBe(fillAxis === 'main' ? size / 2 : size)
              if (fillAxis === 'main')
                expect(child[axis === 'width' ? 'x' : 'y']).toBe((index * size) / 2)
              expect(editor.graph.getChildren(child.id)[0]?.width).toBe(40)
              expect(editor.graph.getChildren(child.id)[0]?.height).toBe(40)
            }
          }
          for (const size of [500, 200, 400, 160, 300]) {
            editor.updateNodeWithUndo(screen().id, { [axis]: size })
            assertSize(size)
          }
          editor.undo.undo()
          assertSize(160)
          editor.undo.redo()
          assertSize(300)
          await reopen()
          editor.updateNode(screen().id, { [axis]: 200 })
          assertSize(200)
          await reopen()
          editor.runLayoutForNode(screen().id)
          assertSize(200)
        } finally {
          editor.dispose()
        }
      })
    }
  }
}
