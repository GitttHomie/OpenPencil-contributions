import { expect, test } from 'bun:test'

import { createFigDocumentSession } from '@open-pencil/fig'
import { rescaleNodeTree } from '@open-pencil/scene-graph'

import { createEditor } from '#core/editor/create'
import { exportFigFile } from '#core/io'
import { initCodec } from '#core/kiwi'

function setup() {
  const editor = createEditor()
  const graph = editor.graph
  const collection = graph.createCollection('Corners')
  const variable = graph.createVariable('Smoothing', 'FLOAT', collection.id, 0.6)
  const alias = graph.createVariable('Control smoothing', 'FLOAT', collection.id, {
    aliasId: variable.id
  })
  const component = graph.createNode('COMPONENT', editor.state.currentPageId, {
    name: 'Smooth control',
    width: 100,
    height: 40,
    cornerRadius: 12,
    cornerSmoothing: 0.2
  })
  return { editor, graph, collection, variable, alias, component }
}

test('smoothing bindings propagate, undo and retain their units when scaled', async () => {
  const { editor, graph, collection, variable, alias, component } = setup()
  try {
    const instance = graph.createInstance(component.id, editor.state.currentPageId)
    if (!instance) throw new Error('Missing instance')
    editor.bindVariable(component.id, 'cornerSmoothing', alias.id)
    await Promise.resolve()
    expect(component.cornerSmoothing).toBe(0.6)
    expect(instance.cornerSmoothing).toBe(0.6)
    editor.undo.undo()
    expect(component.cornerSmoothing).toBe(0.2)
    expect(component.boundVariables.cornerSmoothing).toBeUndefined()
    editor.undo.redo()
    editor.updateVariableValue(variable.id, collection.defaultModeId, 0.75)
    await Promise.resolve()
    expect(instance.cornerSmoothing).toBe(0.75)
    rescaleNodeTree(graph, instance.id, 2)
    editor.updateVariableValue(variable.id, collection.defaultModeId, 0.5)
    await Promise.resolve()
    expect(instance.cornerSmoothing).toBe(0.5)
    expect(instance.variableBindingScales.cornerSmoothing).toBe(1)
    editor.updateVariableValue(variable.id, collection.defaultModeId, 2)
    expect(component.cornerSmoothing).toBe(1)
    editor.updateVariableValue(variable.id, collection.defaultModeId, -1)
    expect(component.cornerSmoothing).toBe(0)
  } finally {
    editor.dispose()
  }
})

test('an OpenPencil .fig retains smoothing aliases and their editable values', async () => {
  const { editor, graph, alias, component } = setup()
  await initCodec()
  try {
    editor.bindVariable(component.id, 'cornerSmoothing', alias.id)
    const bytes = await exportFigFile(graph)
    const session = createFigDocumentSession(bytes.slice().buffer)
    session.loadPage(session.pages[0].id)
    const restored = createEditor({ graph: session.graph })
    try {
      const node = [...restored.graph.nodes.values()].find((node) => node.name === component.name)
      const token = [...restored.graph.variables.values()].find(
        (token) => token.name === 'Smoothing'
      )
      if (!node || !token) throw new Error('Missing saved control or token')
      expect(node.cornerSmoothing).toBeCloseTo(0.6, 6)
      expect(node.boundVariables.cornerSmoothing).toBeDefined()
      const collection = restored.graph.variableCollections.get(token.collectionId)
      if (!collection) throw new Error('Missing token collection')
      restored.updateVariableValue(token.id, collection.defaultModeId, 0.8)
      expect(node.cornerSmoothing).toBe(0.8)
    } finally {
      restored.dispose()
    }
  } finally {
    editor.dispose()
  }
})
