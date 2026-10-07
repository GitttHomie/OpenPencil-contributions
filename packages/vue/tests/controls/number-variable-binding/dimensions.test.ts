import { expect, test } from 'bun:test'

import { computed, effectScope } from 'vue'

import { createEditor } from '@open-pencil/core/editor'

import { createNumberPropertyActions } from '#vue/controls/number-variable-binding/property'

for (const axis of ['width', 'height'] as const) {
  test(`editing shared ${axis} fixes Hug and Fill without changing the other axis and restores both on undo`, () => {
    const editor = createEditor()
    const scope = effectScope()
    try {
      const parent = editor.graph.createNode('FRAME', editor.state.currentPageId, {
        layoutMode: 'HORIZONTAL',
        width: 400,
        height: 200
      })
      const hug = editor.graph.createNode('FRAME', parent.id, {
        layoutMode: 'HORIZONTAL',
        primaryAxisSizing: 'HUG',
        counterAxisSizing: 'HUG'
      })
      editor.graph.createNode('RECTANGLE', hug.id, { width: 50, height: 30 })
      const fill = editor.graph.createNode('FRAME', parent.id, {
        layoutMode: 'VERTICAL',
        primaryAxisSizing: 'FILL',
        counterAxisSizing: 'FILL',
        layoutGrow: 1,
        layoutAlignSelf: 'STRETCH'
      })
      editor.graph.createNode('RECTANGLE', fill.id, { width: 60, height: 40 })
      editor.runLayoutForNode(parent.id)
      const original = [hug, fill].map((node) => ({
        size: node[axis],
        primary: node.primaryAxisSizing,
        counter: node.counterAxisSizing,
        grow: node.layoutGrow,
        align: node.layoutAlignSelf
      }))
      const actions = scope.run(() =>
        createNumberPropertyActions(
          editor,
          computed(() => [hug, fill].map((node) => ({ nodeId: node.id, path: axis })))
        )
      )
      if (!actions) throw new Error('Missing numeric actions')
      actions.update(75.5)
      actions.commit()
      expect([hug[axis], fill[axis]]).toEqual([75.5, 75.5])
      expect(axis === 'width' ? hug.primaryAxisSizing : hug.counterAxisSizing).toBe('FIXED')
      expect(axis === 'width' ? fill.counterAxisSizing : fill.primaryAxisSizing).toBe('FIXED')
      expect(axis === 'width' ? hug.counterAxisSizing : hug.primaryAxisSizing).toBe('HUG')
      editor.undoAction()
      expect(
        [hug, fill].map((node) => ({
          size: node[axis],
          primary: node.primaryAxisSizing,
          counter: node.counterAxisSizing,
          grow: node.layoutGrow,
          align: node.layoutAlignSelf
        }))
      ).toEqual(original)
    } finally {
      scope.stop()
      editor.dispose()
    }
  })
}
