import { expect, test } from 'bun:test'

import { componentPropertyEditTarget, createEditor } from '#core/editor'
import type { ComponentPropertyEditTarget } from '#core/editor'

function setup() {
  const editor = createEditor()
  const component = editor.graph.createNode('COMPONENT', editor.state.currentPageId)
  const text = editor.graph.createNode('TEXT', component.id, { text: 'Button' })
  const propertyId = editor.exposeComponentProperty(text.id, 'TEXT', 'Label')
  if (!propertyId) throw new Error('Missing text property')
  const instance = editor.graph.createInstance(component.id, editor.state.currentPageId)
  if (!instance) throw new Error('Missing instance')
  const instanceText = editor.graph.getChildren(instance.id)[0]
  if (!instanceText) throw new Error('Missing instance text')
  const requests: ComponentPropertyEditTarget[] = []
  editor.onEditorEvent('component-property:edit-requested', (target) => requests.push(target))
  editor.undo.clear()
  return { editor, component, text, propertyId, instance, instanceText, requests }
}

test('linked main text routes to its default without starting or recording a canvas edit', () => {
  const { editor, component, text, propertyId, requests } = setup()
  editor.startTextEditing(text.id)
  expect(editor.state.editingTextId).toBeNull()
  expect([...editor.state.selectedIds]).toEqual([component.id])
  expect(requests).toEqual([
    { nodeId: component.id, propertyId, propertyName: 'Label', kind: 'default' }
  ])
  editor.updateTextEditNode(text.id, { text: 'Bypass' })
  expect(text.text).toBe('Button')
  expect(editor.undo.canUndo).toBe(false)
  editor.setComponentPropertyDefault(component.id, propertyId, 'Purchase')
  expect(text.text).toBe('Purchase')
})

test('linked instance text routes to the override without changing the default', () => {
  const { editor, component, text, propertyId, instance, instanceText, requests } = setup()
  editor.startTextEditing(instanceText.id)
  expect(editor.state.editingTextId).toBeNull()
  expect(requests[0]).toEqual({
    nodeId: instance.id,
    propertyId,
    propertyName: 'Label',
    kind: 'override'
  })
  editor.updateTextEditNode(instanceText.id, { text: 'Bypass' })
  expect(instanceText.text).toBe('Button')
  editor.setInstanceComponentProperty(instance.id, propertyId, 'Custom')
  expect(instanceText.text).toBe('Custom')
  expect(text.text).toBe('Button')
  expect(component.componentPropertyDefinitions[0]?.defaultValue).toBe('Button')
})

test('set-owned text properties navigate to the set definition', () => {
  const { editor, component, text, propertyId } = setup()
  const set = editor.graph.createNode('COMPONENT_SET', editor.state.currentPageId)
  editor.graph.reparentNode(component.id, set.id)
  editor.graph.updateNode(set.id, {
    componentPropertyDefinitions: structuredClone(component.componentPropertyDefinitions)
  })
  editor.graph.updateNode(component.id, { componentPropertyDefinitions: [] })
  expect(componentPropertyEditTarget(editor.graph, text.id, 'TEXT')).toEqual({
    nodeId: set.id,
    propertyId,
    propertyName: 'Label',
    kind: 'default'
  })
})

test('explicit unlink permits canvas editing and undo restores the link', () => {
  const { editor, text } = setup()
  editor.bindComponentProperty(text.id, 'TEXT', null)
  editor.startTextEditing(text.id)
  expect(editor.state.editingTextId).toBe(text.id)
  editor.commitTextEdit()
  editor.undo.undo()
  editor.startTextEditing(text.id)
  expect(editor.state.editingTextId).toBeNull()
  expect(text.text).toBe('Button')
})

test('unresolved text references remain linked instead of silently detaching', () => {
  const { editor, text } = setup()
  editor.graph.updateNode(text.id, {
    componentPropertyReferences: [{ field: 'TEXT', propertyId: 'missing' }]
  })
  editor.startTextEditing(text.id)
  editor.updateTextEditNode(text.id, { text: 'Bypass' })
  expect(editor.state.editingTextId).toBeNull()
  expect(text.text).toBe('Button')
  expect(text.componentPropertyReferences[0]?.propertyId).toBe('missing')
})
