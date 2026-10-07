import { expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { createEditor } from '#core/editor'
import { setTextMeasurer } from '#core/layout'

test('a late property-driven label resizes its Hug instance to the assigned text', async () => {
  const editor = createEditor()
  setTextMeasurer((node, maxWidth) => ({ width: maxWidth ?? node.text.length * 8, height: 12 }))
  try {
    const component = editor.graph.createNode('COMPONENT', editor.state.currentPageId, {
      name: 'Button',
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG',
      paddingLeft: 16,
      paddingRight: 16,
      componentPropertyDefinitions: [
        { id: 'label', name: 'Label', type: 'TEXT', defaultValue: 'Button' }
      ]
    })
    const instance = expectDefined(
      editor.graph.createInstance(component.id, editor.state.currentPageId)
    )
    const assigned = 'A longer button label'
    editor.setInstanceComponentProperty(instance.id, 'label', assigned)
    editor.graph.createNode('TEXT', component.id, {
      text: 'Button',
      textAutoResize: 'WIDTH_AND_HEIGHT',
      componentPropertyReferences: [{ propertyId: 'label', field: 'TEXT' }]
    })
    await Promise.resolve()

    const [label] = editor.graph.getChildren(instance.id)
    expect(label?.text).toBe(assigned)
    expect(instance.width).toBe(assigned.length * 8 + 32)
    expect(instance.width).toBeGreaterThan(component.width)
  } finally {
    editor.dispose()
    setTextMeasurer(null)
  }
})

test('an existing instance inherits badge exclusion, positioning, text alignment and sizing edits', async () => {
  const editor = createEditor()
  setTextMeasurer((node, maxWidth) => ({ width: maxWidth ?? node.text.length * 8, height: 12 }))
  try {
    const component = editor.graph.createNode('COMPONENT', editor.state.currentPageId, {
      name: 'Button',
      x: 40,
      y: 60,
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG',
      paddingLeft: 16,
      paddingRight: 16,
      paddingTop: 12,
      paddingBottom: 12
    })
    editor.graph.createNode('TEXT', component.id, { text: 'Button', width: 48, height: 12 })
    editor.runLayoutForNode(component.id)
    const instance = expectDefined(
      editor.graph.createInstance(component.id, editor.state.currentPageId, { x: 320, y: 60 })
    )
    const badge = editor.graph.createNode('FRAME', component.id, { width: 24, height: 24 })
    await Promise.resolve()
    const copy = expectDefined(
      editor.graph.getChildren(instance.id).find((node) => node.componentId === badge.id)
    )
    editor.setLayoutPositioning([badge.id], 'ABSOLUTE')
    editor.updateNodeWithUndo(badge.id, {
      x: 68,
      y: -8,
      horizontalConstraint: 'MAX',
      verticalConstraint: 'MIN'
    })
    await Promise.resolve()
    expect(copy).toMatchObject({
      layoutPositioning: 'ABSOLUTE',
      x: 68,
      y: -8,
      horizontalConstraint: 'MAX'
    })
    expect(instance).toMatchObject({
      x: 320,
      y: 60,
      width: component.width,
      height: component.height
    })
    const text = editor.graph.createNode('TEXT', badge.id, {
      text: '1',
      width: 8,
      height: 12,
      textAutoResize: 'WIDTH_AND_HEIGHT'
    })
    await Promise.resolve()
    const number = expectDefined(
      editor.graph.getChildren(copy.id).find((node) => node.componentId === text.id)
    )
    editor.alignNodes([text.id], 'horizontal', 'center')
    editor.alignNodes([text.id], 'vertical', 'center')
    await Promise.resolve()
    expect(number).toMatchObject({ x: 8, y: 6 })
    editor.updateNodeWithUndo(text.id, {
      x: 0,
      width: 24,
      textAlignHorizontal: 'CENTER',
      textAlignVertical: 'CENTER'
    })
    await Promise.resolve()
    expect(number).toMatchObject({
      x: 0,
      width: 24,
      textAlignHorizontal: 'CENTER',
      textAlignVertical: 'CENTER',
      textAutoResize: 'HEIGHT'
    })
    editor.updateNodeWithUndo(text.id, { fontWeight: 700 })
    await Promise.resolve()
    expect(text).toMatchObject({ width: 24, textAutoResize: 'HEIGHT' })
    expect(number).toMatchObject({ width: 24, textAutoResize: 'HEIGHT', fontWeight: 700 })
    editor.undoAction()
    await Promise.resolve()
    expect(number).toMatchObject({ width: 24, fontWeight: 400 })
    editor.undoAction()
    await Promise.resolve()
    expect(number).toMatchObject({
      x: 8,
      width: 8,
      textAutoResize: 'WIDTH_AND_HEIGHT',
      textAlignHorizontal: 'LEFT'
    })
  } finally {
    editor.dispose()
    setTextMeasurer(null)
  }
})
