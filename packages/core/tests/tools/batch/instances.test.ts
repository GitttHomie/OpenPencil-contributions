import { expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'

import { FigmaAPI } from '#core/figma-api'
import { setTextMeasurer } from '#core/layout'
import { setInstanceProperties } from '#core/tools/component-properties'
import { createInstance } from '#core/tools/create/components'

test('create connected rows with initial overrides and Fill sizing in one undoable edit', () => {
  const editor = createEditor()
  const graph = editor.graph
  const figma = new FigmaAPI(graph)
  setTextMeasurer((node) => ({ width: node.text.length * 8, height: 16 }))
  try {
    const component = graph.createNode('COMPONENT', figma.currentPageId, {
      name: 'Row',
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'HUG',
      width: 200
    })
    const label = graph.createNode('TEXT', component.id, {
      text: 'Default',
      textAutoResize: 'WIDTH_AND_HEIGHT'
    })
    const action = graph.createNode('FRAME', component.id, { width: 24, height: 32 })
    const textId = editor.exposeComponentProperty(label.id, 'TEXT', 'Label')
    const visibleId = editor.exposeComponentProperty(action.id, 'VISIBLE', 'Action')
    if (!textId || !visibleId) throw new Error('Expected properties')
    const list = graph.createNode('FRAME', figma.currentPageId, {
      layoutMode: 'VERTICAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'FIXED',
      width: 320
    })
    editor.runLayoutForNode(figma.currentPageId)
    const finish = editor.captureDocumentChange(figma.currentPageId)
    expect(
      createInstance.execute(figma, {
        items: Array.from({ length: 20 }, (_, index) => ({
          component_id: component.id,
          parent_id: list.id,
          sizing_horizontal: 'FILL',
          values: { [textId]: `Setting ${index}`, [visibleId]: false }
        }))
      })
    ).toMatchObject({ updated: 20 })
    editor.runLayoutForNode(figma.currentPageId)
    const change = finish()
    const rows = graph.getChildren(list.id)
    expect(rows).toHaveLength(20)
    for (const [index, row] of rows.entries()) {
      expect(row.type).toBe('INSTANCE')
      expect(row.componentId).toBe(component.id)
      expect(row.width).toBe(320)
      expect(row.height).toBe(16)
      expect(graph.getChildren(row.id).map((child) => [child.text, child.visible])).toEqual([
        [`Setting ${index}`, true],
        ['', false]
      ])
    }
    editor.pushUndoStep({
      label: 'Create rows',
      inverse: () => editor.restoreDocumentChange(change, 'before'),
      forward: () => editor.restoreDocumentChange(change, 'after')
    })
    editor.undo.undo()
    expect(graph.getChildren(list.id)).toHaveLength(0)
    editor.undo.redo()
    expect(graph.getChildren(list.id)).toHaveLength(20)
    expect(() =>
      setInstanceProperties.execute(figma, {
        items: [
          { id: rows[0].id, values: { [textId]: 'Changed' } },
          { id: rows[1].id, values: { missing: 'Invalid' } }
        ]
      })
    ).toThrow('no batch changes were kept')
    expect(graph.getChildren(rows[0].id)[0].text).toBe('Setting 0')
    setInstanceProperties.execute(figma, {
      ids: rows.map((row) => row.id),
      values: { [visibleId]: true }
    })
    editor.runLayoutForNode(figma.currentPageId)
    for (const row of graph.getChildren(list.id)) expect(row.height).toBe(32)
  } finally {
    setTextMeasurer(null)
    editor.dispose()
  }
})

test('failed initial overrides and component cycles leave no orphan instances', () => {
  const editor = createEditor()
  const figma = new FigmaAPI(editor.graph)
  try {
    const component = editor.graph.createNode('COMPONENT', figma.currentPageId)
    const before = editor.graph.nodes.size
    expect(() =>
      createInstance.execute(figma, {
        component_id: component.id,
        values: { missing: 'bad' }
      })
    ).toThrow()
    expect(editor.graph.nodes.size).toBe(before)
    expect(() =>
      createInstance.execute(figma, {
        items: [
          { component_id: component.id },
          { component_id: component.id, parent_id: component.id }
        ]
      })
    ).toThrow('component cycle')
    expect(editor.graph.nodes.size).toBe(before)
    expect(createInstance.execute(figma, { component_id: component.id })).toMatchObject({
      type: 'INSTANCE'
    })
  } finally {
    editor.dispose()
  }
})
