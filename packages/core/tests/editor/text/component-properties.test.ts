import { afterEach, expect, test } from 'bun:test'

import type { CanvasKit } from 'canvaskit-wasm'

import type { SceneNode } from '@open-pencil/scene-graph'

import { componentPropertyEditTarget, createEditor, createTextActions } from '#core/editor'
import type { ComponentPropertyEditTarget } from '#core/editor'
import { iconify } from '#core/icons'
import { computeAllLayouts, setTextMeasurer } from '#core/layout'
import { TextEditor } from '#core/text/editor'

const editors: ReturnType<typeof createEditor>[] = []
afterEach(() => {
  for (const editor of editors.splice(0)) editor.dispose()
  setTextMeasurer(null)
})

function setup() {
  const base = createEditor()
  editors.push(base)
  const textEditor = new TextEditor({} as CanvasKit)
  const actions = createTextActions({
    ...base,
    graph: base.graph,
    icons: iconify,
    getTextEditor: () => textEditor,
    getRenderer: () => null,
    getCk: () => null,
    loadFont: async () => null,
    resolveFigmaClipboardImages: null,
    getViewportSize: () => ({ width: 800, height: 600 }),
    setSelectedIds: (ids) => base.select([...ids]),
    setActiveTool: (tool) => base.setTool(tool),
    emitEditorEvent: (event, ...args) => {
      if (event === 'component-property:edit-requested') {
        const target = args[0]
        if (target && typeof target === 'object' && 'propertyId' in target)
          requests.push(target as ComponentPropertyEditTarget)
      }
    }
  })
  const editor = { ...base, ...actions }
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
  function replaceText(value: string, node: SceneNode = instanceText) {
    textEditor.selectAll()
    textEditor.insert(value, node)
    editor.updateTextEditNode(node.id, { text: value })
  }
  return { editor, component, text, propertyId, instance, instanceText, requests, replaceText }
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

test('linked instance text edits on canvas and updates the override without changing the default', () => {
  const { editor, component, text, propertyId, instance, instanceText, requests } = setup()
  editor.startTextEditing(instanceText.id)
  expect(editor.state.editingTextId).toBe(instanceText.id)
  expect(requests).toEqual([])
  editor.updateTextEditNode(instanceText.id, { text: 'Bypass' })
  expect(instanceText.text).toBe('Bypass')
  expect(instance.componentPropertyAssignments[propertyId]).toBe('Bypass')
  editor.setInstanceComponentProperty(instance.id, propertyId, 'Custom')
  expect(instanceText.text).toBe('Custom')
  expect(text.text).toBe('Button')
  expect(component.componentPropertyDefinitions[0]?.defaultValue).toBe('Button')
})

test('typing updates every bound layer in this occurrence, with one undo step and redo', () => {
  const { editor, component, text, propertyId, instance, instanceText, replaceText } = setup()
  const other = editor.graph.createNode('TEXT', component.id, { text: 'Button' })
  editor.bindComponentProperty(other.id, 'TEXT', propertyId)
  editor.graph.syncInstances(component.id)
  const sibling = editor.graph.createInstance(component.id, editor.state.currentPageId)
  if (!sibling) throw new Error('Missing sibling instance')
  editor.undo.clear()
  editor.startTextEditing(instanceText.id)
  replaceText('Buy')
  replaceText('Buy a subscription')
  expect(editor.graph.getChildren(instance.id).map((node) => node.text)).toEqual([
    'Buy a subscription',
    'Buy a subscription'
  ])
  expect(
    editor.getInstanceComponentPropertyValue(instance.id, component.componentPropertyDefinitions[0])
  ).toBe('Buy a subscription')
  expect(editor.undo.canUndo).toBe(false)
  editor.commitTextEdit()
  expect(instance.componentPropertyAssignments[propertyId]).toBe('Buy a subscription')
  expect(text.text).toBe('Button')
  expect(editor.graph.getChildren(sibling.id).map((node) => node.text)).toEqual([
    'Button',
    'Button'
  ])
  editor.undo.undo()
  expect(editor.graph.getChildren(instance.id).map((node) => node.text)).toEqual([
    'Button',
    'Button'
  ])
  expect(instance.componentPropertyAssignments).not.toHaveProperty(propertyId)
  expect(editor.undo.canUndo).toBe(false)
  editor.undo.redo()
  expect(editor.graph.getChildren(instance.id).map((node) => node.text)).toEqual([
    'Buy a subscription',
    'Buy a subscription'
  ])
  expect(instance.componentPropertyAssignments[propertyId]).toBe('Buy a subscription')
  editor.setComponentPropertyDefault(component.id, propertyId, 'New default')
  expect(instanceText.text).toBe('Buy a subscription')
})

test('returning to the original value retains inheritance without an undo entry', () => {
  const { editor, instance, instanceText, propertyId, replaceText } = setup()
  editor.startTextEditing(instanceText.id)
  replaceText('Changed')
  replaceText('Button')
  editor.commitTextEdit()
  expect(instance.componentPropertyAssignments).not.toHaveProperty(propertyId)
  expect(editor.undo.canUndo).toBe(false)
})

test('instance text edits grow Hug layout and preserve the chosen text sizing mode', () => {
  const { editor, instance, instanceText, replaceText } = setup()
  setTextMeasurer((node) => ({ width: node.text.length * 10, height: 20 }))
  editor.graph.updateNode(instance.id, {
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'HUG'
  })
  editor.graph.updateNode(instanceText.id, { textAutoResize: 'WIDTH_AND_HEIGHT' })
  computeAllLayouts(editor.graph)
  const width = instance.width
  editor.startTextEditing(instanceText.id)
  replaceText('A much longer button')
  expect(instance.width).toBeGreaterThan(width)
  expect(instanceText.textAutoResize).toBe('WIDTH_AND_HEIGHT')
  editor.commitTextEdit()
  editor.undo.undo()
  expect(instance.width).toBe(width)
  editor.redoAction()
  expect(instance.width).toBeGreaterThan(width)
})

test('canvas overrides of exposed nested text survive outer synchronization and update the parent control', () => {
  const { editor, component, instance, propertyId, replaceText } = setup()
  const parent = editor.graph.createNode('COMPONENT', editor.state.currentPageId)
  editor.graph.reparentNode(instance.id, parent.id)
  editor.setNestedComponentPropertyExposure(parent.id, instance.id, [propertyId])
  const occurrence = editor.graph.createInstance(parent.id, editor.state.currentPageId)
  if (!occurrence) throw new Error('Missing parent occurrence')
  const nested = editor.graph.getChildren(occurrence.id)[0]
  const label = editor.graph.getChildren(nested.id)[0]
  const property = editor.getInstanceComponentPropertyDefinitions(occurrence.id)[0]
  if (!property) throw new Error('Missing exposed nested property')
  editor.undo.clear()
  editor.startTextEditing(label.id)
  replaceText('Nested override', label)
  editor.commitTextEdit()
  expect(editor.getInstanceComponentPropertyValue(occurrence.id, property)).toBe('Nested override')
  editor.graph.syncInstances(parent.id)
  editor.graph.syncInstances(component.id)
  expect(label.text).toBe('Nested override')
  expect(editor.getInstanceComponentPropertyValue(occurrence.id, property)).toBe('Nested override')
  editor.undo.undo()
  expect(label.text).toBe('Button')
  editor.undo.redo()
  expect(label.text).toBe('Nested override')
  editor.setInstanceComponentProperty(occurrence.id, property.id, 'From parent panel')
  expect(label.text).toBe('From parent panel')
})

test('canvas editing keeps a fixed text box fixed and restores existing overrides', () => {
  const { editor, instance, instanceText, propertyId, replaceText } = setup()
  editor.setInstanceComponentProperty(instance.id, propertyId, 'Existing')
  editor.graph.updateNode(instanceText.id, { textAutoResize: 'NONE', width: 60, height: 20 })
  editor.undo.clear()
  editor.startTextEditing(instanceText.id)
  replaceText('A long replacement in a fixed box')
  editor.commitTextEdit()
  expect(instanceText).toMatchObject({ textAutoResize: 'NONE', width: 60, height: 20 })
  editor.undo.undo()
  expect(instance.componentPropertyAssignments[propertyId]).toBe('Existing')
  expect(instanceText.text).toBe('Existing')
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
