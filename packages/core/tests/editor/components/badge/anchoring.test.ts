import { expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { createEditor } from '#core/editor'
import { getTextMeasurer, setTextMeasurer } from '#core/layout'

test('Hug badge growth retains right overhang in the component and instance through Undo and Redo', async () => {
  const previous = getTextMeasurer()
  setTextMeasurer((node) => ({ width: node.text.length * 8, height: 12 }))
  const editor = createEditor()
  try {
    const component = editor.graph.createNode('COMPONENT', editor.state.currentPageId, {
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG',
      paddingLeft: 16,
      paddingRight: 16,
      paddingTop: 12,
      paddingBottom: 12
    })
    editor.graph.createNode('TEXT', component.id, { text: 'Button', width: 48, height: 12 })
    const badge = editor.graph.createNode('FRAME', component.id, {
      layoutMode: 'HORIZONTAL',
      layoutPositioning: 'ABSOLUTE',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG',
      primaryAxisAlign: 'MAX',
      horizontalConstraint: 'MAX',
      width: 16,
      height: 20,
      y: -8,
      paddingLeft: 4,
      paddingRight: 4,
      paddingTop: 4,
      paddingBottom: 4
    })
    const number = editor.graph.createNode('TEXT', badge.id, {
      text: '1',
      width: 8,
      height: 12,
      textAutoResize: 'WIDTH_AND_HEIGHT'
    })
    editor.runLayoutForNode(component.id)
    editor.graph.updateNode(badge.id, { x: component.width - badge.width + 8 })
    const instance = expectDefined(
      editor.graph.createInstance(component.id, editor.state.currentPageId, { x: 300 })
    )
    await Promise.resolve()
    const copy = expectDefined(
      editor.graph.getChildren(instance.id).find((node) => node.componentId === badge.id)
    )
    const numberCopy = expectDefined(
      editor.graph.getChildren(copy.id).find((node) => node.componentId === number.id)
    )
    const small = badge.width
    function check() {
      for (const [container, item] of [
        [component, badge],
        [instance, copy]
      ]) {
        expect(item.x + item.width - container.width).toBeCloseTo(8)
        expect(item.y).toBe(-8)
      }
    }
    check()
    editor.updateNodeWithUndo(number.id, { text: '9999' })
    await Promise.resolve()
    check()
    expect(copy.width).toBe(badge.width)
    expect(badge.width).toBeGreaterThan(small)
    editor.updateNodeWithUndo(numberCopy.id, { text: '999999' })
    await Promise.resolve()
    check()
    expect(copy.width).toBeGreaterThan(badge.width)
    editor.undoAction()
    await Promise.resolve()
    check()
    expect(copy.width).toBe(badge.width)
    editor.undoAction()
    await Promise.resolve()
    check()
    expect(badge.width).toBe(small)
    editor.redoAction()
    await Promise.resolve()
    check()
    expect(badge.width).toBeGreaterThan(small)
  } finally {
    editor.dispose()
    setTextMeasurer(previous)
  }
})
