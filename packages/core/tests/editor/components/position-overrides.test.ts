import { expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { hasInstanceOverride } from '@open-pencil/scene-graph'

import { createEditor } from '#core/editor'
import { captureMoveState } from '#core/editor/history/move'

for (const gesture of ['align', 'nudge', 'move'] as const) {
  test(`${gesture} keeps an instance child's position override and Undo restores inheritance`, async () => {
    const editor = createEditor()
    try {
      const component = editor.graph.createNode('COMPONENT', editor.state.currentPageId, {
        width: 100,
        height: 100
      })
      const badge = editor.graph.createNode('FRAME', component.id, {
        x: 10,
        y: 10,
        width: 20,
        height: 20
      })
      const instance = expectDefined(
        editor.graph.createInstance(component.id, editor.state.currentPageId)
      )
      const copy = expectDefined(editor.graph.getChildren(instance.id)[0])
      await Promise.resolve()
      editor.select([copy.id])
      if (gesture === 'align') editor.alignNodes([copy.id], 'horizontal', 'center')
      else if (gesture === 'nudge') {
        editor.nudgeSelected(1, 0)
        editor.nudgeSelected(0, 1)
      } else {
        const before = new Map([[copy.id, captureMoveState(editor.graph, copy)]])
        editor.graph.updateNode(copy.id, { x: 40 })
        editor.commitMoveWithReparent(before)
      }
      const x = copy.x
      editor.graph.updateNode(badge.id, { x: 15 })
      await Promise.resolve()
      expect(copy.x).toBe(x)
      expect(hasInstanceOverride(editor.graph, copy.id, 'x')).toBe(true)
      editor.undoAction()
      expect(hasInstanceOverride(editor.graph, copy.id, 'x')).toBe(false)
      editor.redoAction()
      expect(hasInstanceOverride(editor.graph, copy.id, 'x')).toBe(true)
      if (gesture === 'nudge') expect(hasInstanceOverride(editor.graph, copy.id, 'y')).toBe(true)
      editor.undoAction()
      editor.graph.updateNode(badge.id, { x: 25 })
      await Promise.resolve()
      expect(copy.x).toBe(25)
    } finally {
      editor.dispose()
    }
  })
}
