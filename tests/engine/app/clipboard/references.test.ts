import { expect, test } from 'bun:test'

import { createEditorStore } from '@/app/editor/session/create'

test('pasting a component and instance together keeps links and remaps local overrides', async () => {
  const editor = createEditorStore()
  const page = editor.state.currentPageId
  const component = editor.graph.createNode('COMPONENT', page, { name: 'Master' })
  const child = editor.graph.createNode('RECTANGLE', component.id, { name: 'Master child' })
  const instance = editor.graph.createNode('INSTANCE', page, {
    name: 'Instance',
    componentId: component.id
  })
  const instanceChild = editor.graph.createNode('RECTANGLE', instance.id, {
    name: 'Instance child',
    componentId: child.id
  })
  instanceChild.name = 'Overridden'
  instance.instanceOverrides.descendants.set(instanceChild.id, new Map([['name', 'Overridden']]))
  editor.select([component.id, instance.id])
  const payload = await editor.prepareCopy()
  if (!payload.snapshot) throw new Error('Missing snapshot')
  await editor.pasteSnapshot(payload.snapshot)
  const pasted = [...editor.state.selectedIds].map((id) => editor.graph.getNode(id))
  expect(pasted.map((node) => node?.type)).toEqual(['INSTANCE', 'INSTANCE'])
  expect(pasted.map((node) => node?.componentId)).toEqual([component.id, component.id])
  const copy = pasted.find((node) => node?.name === 'Instance')
  if (!copy) throw new Error('Missing pasted instance')
  const copiedChild = editor.graph.getNode(copy.childIds[0])
  if (!copiedChild) throw new Error('Missing pasted child')
  expect(copiedChild.id).not.toBe(instanceChild.id)
  expect(copiedChild.componentId).toBe(child.id)
  expect(copiedChild.name).toBe('Overridden')
  expect(copy.instanceOverrides.descendants.get(copiedChild.id)?.get('name')).toBe('Overridden')
  editor.undo.undo()
  expect(editor.graph.getNode(copy.id)).toBeUndefined()
  editor.undo.redo()
  expect(editor.graph.getNode(copy.id)?.componentId).toBe(component.id)
  expect(editor.graph.getNode(copiedChild.id)?.componentId).toBe(child.id)
  expect(editor.graph.getNode(copiedChild.id)?.name).toBe('Overridden')
})
