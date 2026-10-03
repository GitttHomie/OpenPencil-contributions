import { expect, test } from 'bun:test'

import { computed, effectScope } from 'vue'

import { createEditor } from '@open-pencil/core/editor'

import { createLayoutActions } from '#vue/controls/layout/helpers'

for (const mode of ['HORIZONTAL', 'VERTICAL'] as const) {
  for (const sizing of ['HUG', 'FILL'] as const) {
    for (const axis of ['width', 'height'] as const) {
      test(`${mode} ${sizing}: typing ${axis} fixes only that axis and undo restores its mode`, () => {
        const editor = createEditor()
        const scope = effectScope()
        try {
          const parent = editor.graph.createNode('FRAME', editor.state.currentPageId, {
            width: 300,
            height: 200,
            layoutMode: mode === 'HORIZONTAL' ? 'VERTICAL' : 'HORIZONTAL',
            counterAxisAlign: sizing === 'FILL' ? 'STRETCH' : 'MIN'
          })
          const child = editor.graph.createNode('FRAME', parent.id, {
            layoutMode: mode,
            primaryAxisSizing: sizing,
            counterAxisSizing: sizing,
            layoutGrow: sizing === 'FILL' ? 1 : 0,
            layoutAlignSelf: sizing === 'FILL' ? 'STRETCH' : 'AUTO'
          })
          editor.graph.createNode('FRAME', child.id, { width: 80, height: 40 })
          editor.runLayoutForNode(parent.id)
          const actions = scope.run(() =>
            createLayoutActions({
              editor,
              node: computed(() => child),
              isInAutoLayout: computed(() => true)
            })
          )
          if (!actions) throw new Error('Layout controls unavailable')
          const original = child[axis]
          const key =
            axis === (mode === 'HORIZONTAL' ? 'width' : 'height')
              ? 'primaryAxisSizing'
              : 'counterAxisSizing'
          const other = key === 'primaryAxisSizing' ? 'counterAxisSizing' : 'primaryAxisSizing'
          actions.updateAxisSize(axis, 70.5)
          expect(child[axis]).toBe(70.5)
          expect(child[key]).toBe('FIXED')
          expect(child[other]).toBe(sizing)
          actions.commitAxisSize(axis, 70.5, original)
          editor.undoAction()
          expect(child[axis]).toBe(original)
          expect(child[key]).toBe(sizing)
          expect(child[other]).toBe(sizing)
          editor.redoAction()
          expect(child[axis]).toBe(70.5)
          expect(child[key]).toBe('FIXED')
          expect(child[other]).toBe(sizing)
        } finally {
          scope.stop()
          editor.dispose()
        }
      })
    }
  }
}
