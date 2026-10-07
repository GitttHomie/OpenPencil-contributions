import { expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { createEditor } from '#core/editor'
import { setTextMeasurer } from '#core/layout'

for (const textAutoResize of ['WIDTH_AND_HEIGHT', 'HEIGHT', 'NONE'] as const) {
  test(`exposed ${textAutoResize} text updates instance layout, siblings and undo`, async () => {
    const editor = createEditor()
    setTextMeasurer((node, maxWidth) => ({
      width: maxWidth ?? node.text.length * 8,
      height: 12 * Math.max(1, Math.ceil((node.text.length * 8) / (maxWidth ?? Infinity)))
    }))
    try {
      const page = editor.state.currentPageId
      const component = editor.graph.createNode('COMPONENT', page, {
        layoutMode: 'HORIZONTAL',
        primaryAxisSizing: 'HUG',
        counterAxisSizing: 'HUG',
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 8,
        paddingBottom: 8
      })
      const label = editor.graph.createNode('TEXT', component.id, {
        name: 'Label',
        text: 'Button',
        textAutoResize,
        width: 48,
        height: 12
      })
      const property = expectDefined(editor.exposeComponentProperty(label.id, 'TEXT', 'Label'))
      const row = editor.graph.createNode('FRAME', page, {
        layoutMode: 'HORIZONTAL',
        primaryAxisSizing: 'HUG',
        counterAxisSizing: 'HUG',
        itemSpacing: 12
      })
      editor.runLayoutForNode(component.id)
      const instance = expectDefined(editor.graph.createInstance(component.id, row.id))
      const sibling = editor.graph.createNode('FRAME', row.id, { width: 20, height: 20 })
      editor.runLayoutForNode(row.id)
      await Promise.resolve()
      const initial = {
        width: instance.width,
        height: instance.height,
        siblingX: sibling.x,
        rowWidth: row.width
      }
      const text = expectDefined(editor.graph.getChildren(instance.id)[0])
      editor.setInstanceComponentProperty(instance.id, property, 'A much longer button')
      if (textAutoResize === 'WIDTH_AND_HEIGHT') {
        expect(instance.width).toBe(160 + 32)
        expect(sibling.x).toBe(instance.width + 12)
        expect(row.width).toBe(instance.width + 12 + sibling.width)
      } else if (textAutoResize === 'HEIGHT') {
        expect(text.width).toBe(48)
        expect(instance.height).toBe(48 + 16)
      } else {
        expect(text).toMatchObject({ width: 48, height: 12 })
        expect(instance).toMatchObject({ width: initial.width, height: initial.height })
      }
      expect(text.textAutoResize).toBe(textAutoResize)
      expect(component.width).toBe(initial.width)
      const changed = { width: instance.width, height: instance.height }
      await Promise.resolve()
      expect(instance).toMatchObject(changed)
      editor.undo.undo()
      expect(text.text).toBe('Button')
      expect(instance).toMatchObject({ width: initial.width, height: initial.height })
      expect(sibling.x).toBe(initial.siblingX)
      expect(row.width).toBe(initial.rowWidth)
      editor.undo.redo()
      expect(instance).toMatchObject(changed)
      editor.setInstanceComponentProperty(instance.id, property, 'Hi')
      if (textAutoResize === 'WIDTH_AND_HEIGHT') expect(instance.width).toBe(16 + 32)
      if (textAutoResize === 'HEIGHT') expect(instance.height).toBe(initial.height)
    } finally {
      editor.dispose()
      setTextMeasurer(null)
    }
  })
}
