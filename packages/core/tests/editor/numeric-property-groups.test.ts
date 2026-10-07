import { expect, test } from 'bun:test'

import { CORNER_RADIUS_PATHS, numberPropertyValue } from '@open-pencil/scene-graph'

import { createEditor } from '#core/editor'
import { exportFigFile, parseFigFile } from '#core/io'

test('untouched instance corners follow later changes to a shared component binding', () => {
  const editor = createEditor()
  const page = editor.graph.getPages()[0]
  if (!page) throw new Error('Missing page')
  const collection = editor.graph.createCollection('Radii')
  const small = editor.graph.createVariable('Small', 'FLOAT', collection.id, 8)
  const large = editor.graph.createVariable('Large', 'FLOAT', collection.id, 24)
  const component = editor.graph.createNode('COMPONENT', page.id, { cornerRadius: 8 })
  editor.bindVariable(component.id, 'cornerRadius', small.id)
  const instance = editor.graph.createInstance(component.id, page.id)
  if (!instance) throw new Error('Missing instance')
  editor.undo.runBatch('Detach one corner', () => {
    editor.prepareNumberProperty(instance.id, 'topLeftRadius')
    editor.unbindVariable(instance.id, 'topLeftRadius')
    editor.updateNodeWithUndo(instance.id, { topLeftRadius: 8 })
  })
  editor.bindVariable(component.id, 'cornerRadius', large.id)
  editor.graph.syncInstances(component.id)
  expect(instance.independentCorners).toBe(true)
  expect(CORNER_RADIUS_PATHS.map((path) => numberPropertyValue(instance, path))).toEqual([
    8, 24, 24, 24
  ])
  expect(CORNER_RADIUS_PATHS.map((path) => instance.boundVariables[path])).toEqual([
    undefined,
    large.id,
    large.id,
    large.id
  ])
})

test('a literal per-side edit also protects its value from a later inherited binding', () => {
  const editor = createEditor()
  const page = editor.graph.getPages()[0]
  if (!page) throw new Error('Missing page')
  const component = editor.graph.createNode('COMPONENT', page.id, { cornerRadius: 8 })
  const instance = editor.graph.createInstance(component.id, page.id)
  if (!instance) throw new Error('Missing instance')
  editor.prepareNumberProperty(instance.id, 'topLeftRadius')
  editor.updateNodeWithUndo(instance.id, { topLeftRadius: 12 })
  const collection = editor.graph.createCollection('Radii')
  const variable = editor.graph.createVariable('Large', 'FLOAT', collection.id, 24)
  editor.bindVariable(component.id, 'cornerRadius', variable.id)
  editor.graph.syncInstances(component.id)
  expect(CORNER_RADIUS_PATHS.map((path) => numberPropertyValue(instance, path))).toEqual([
    12, 24, 24, 24
  ])
  editor.updateVariableValue(variable.id, collection.defaultModeId, 32)
  expect(CORNER_RADIUS_PATHS.map((path) => numberPropertyValue(instance, path))).toEqual([
    12, 32, 32, 32
  ])
})

test('independent values and mixed bindings survive saving and reopening a .fig file', async () => {
  const editor = createEditor()
  const page = editor.graph.getPages()[0]
  if (!page) throw new Error('Missing page')
  const collection = editor.graph.createCollection('Radii')
  const variable = editor.graph.createVariable('Medium', 'FLOAT', collection.id, 16)
  const node = editor.graph.createNode('FRAME', page.id, {
    name: 'Mixed corners',
    cornerRadius: 16
  })
  editor.bindVariable(node.id, 'cornerRadius', variable.id)
  editor.prepareNumberProperty(node.id, 'topLeftRadius')
  editor.unbindVariable(node.id, 'topLeftRadius')
  editor.updateNodeWithUndo(node.id, { topLeftRadius: 4 })
  const data = await exportFigFile(editor.graph)
  const reopened = await parseFigFile(data.slice().buffer as ArrayBuffer)
  const restored = reopened.getAllNodes().find((node) => node.name === 'Mixed corners')
  if (!restored) throw new Error('Missing reopened frame')
  expect(restored.independentCorners).toBe(true)
  expect(CORNER_RADIUS_PATHS.map((path) => restored[path])).toEqual([4, 16, 16, 16])
  expect(restored.boundVariables.topLeftRadius).toBeUndefined()
  for (const path of CORNER_RADIUS_PATHS.slice(1)) {
    expect(reopened.variables.get(restored.boundVariables[path])?.name).toBe('Medium')
  }
})
