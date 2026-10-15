import { expect, test } from 'bun:test'

import { createEditor } from '#core/editor/create'
import { exportFigFile, parseFigFile } from '#core/io'

function setup() {
  const editor = createEditor()
  const graph = editor.graph
  const collection = graph.createCollection('Visibility')
  const variable = graph.createVariable('Show', 'BOOLEAN', collection.id, false)
  const component = graph.createNode('COMPONENT', editor.state.currentPageId, {
    name: 'Button',
    width: 100,
    height: 40
  })
  const child = graph.createNode('TEXT', component.id, {
    name: 'Label',
    text: 'Hello',
    visible: true
  })
  const first = graph.createInstance(component.id, editor.state.currentPageId)
  const second = graph.createInstance(component.id, editor.state.currentPageId)
  if (!first || !second) throw new Error('Missing instances')
  return { editor, graph, collection, variable, component, child, first, second }
}

test('detaching inherited visibility keeps the current value when the component changes', async () => {
  const { editor, graph, variable, child, first, second, collection } = setup()
  try {
    editor.bindVariable(child.id, 'visible', variable.id)
    await Promise.resolve()
    const target = graph.getChildren(first.id)[0]
    editor.unbindVariable(target.id, 'visible')
    editor.updateVariableValue(variable.id, collection.defaultModeId, true)
    expect(target.visible).toBe(false)
    expect(target.boundVariables.visible).toBeUndefined()
    expect(graph.getChildren(second.id)[0].visible).toBe(true)
    const restored = await parseFigFile((await exportFigFile(graph)).slice().buffer)
    expect(
      [...restored.getAllNodes()]
        .filter((n) => n.name === 'Label')
        .map((n) => n.visible)
        .sort()
    ).toEqual([false, true, true])
  } finally {
    editor.dispose()
  }
})

test('visibility binding restores its literal on undo and propagates from a definition', async () => {
  const { editor, graph, variable, child, first, second, collection } = setup()
  try {
    editor.bindVariable(child.id, 'visible', variable.id)
    await Promise.resolve()
    expect(
      [child, ...graph.getChildren(first.id), ...graph.getChildren(second.id)].map((n) => n.visible)
    ).toEqual([false, false, false])
    editor.undo.undo()
    expect(child.visible).toBe(true)
    editor.undo.redo()
    editor.updateVariableValue(variable.id, collection.defaultModeId, true)
    expect(
      [child, ...graph.getChildren(first.id), ...graph.getChildren(second.id)].map((n) => n.visible)
    ).toEqual([true, true, true])
  } finally {
    editor.dispose()
  }
})

test('a new binding replaces an instance visibility override and stays local through sync and saving', async () => {
  const { editor, graph, variable, child, first, second, component, collection } = setup()
  try {
    const target = graph.getChildren(first.id)[0]
    editor.updateNodeWithUndo(target.id, { visible: true })
    editor.bindVariable(target.id, 'visible', variable.id)
    expect(target.visible).toBe(false)
    graph.syncInstances(component.id)
    editor.updateVariableValue(variable.id, collection.defaultModeId, true)
    editor.updateVariableValue(variable.id, collection.defaultModeId, false)
    expect(target.visible).toBe(false)
    expect(child.visible).toBe(true)
    expect(graph.getChildren(second.id)[0].visible).toBe(true)
    const restored = await parseFigFile((await exportFigFile(graph)).slice().buffer)
    const labels = [...restored.getAllNodes()].filter((n) => n.name === 'Label')
    expect(labels.map((n) => n.visible).sort()).toEqual([false, true, true])
  } finally {
    editor.dispose()
  }
})

test('a nested visibility variable overrides the exposed property only in that instance', async () => {
  const { editor, graph, variable, child, first, second, component, collection } = setup()
  try {
    const property = editor.exposeComponentProperty(child.id, 'VISIBLE', 'Show label')
    if (!property) throw new Error('Missing exposed property')
    editor.setInstanceComponentProperty(first.id, property, 'true')
    const target = graph.getChildren(first.id)[0]
    editor.bindVariable(target.id, 'visible', variable.id)
    expect(target.visible).toBe(false)
    editor.setInstanceComponentProperty(first.id, property, 'false')
    editor.setInstanceComponentProperty(first.id, property, 'true')
    graph.syncInstances(component.id)
    expect(target.visible).toBe(false)
    expect(child.visible).toBe(true)
    expect(graph.getChildren(second.id)[0].visible).toBe(true)
    editor.updateVariableValue(variable.id, collection.defaultModeId, true)
    expect(target.visible).toBe(true)
    editor.updateVariableValue(variable.id, collection.defaultModeId, false)
    const restored = await parseFigFile((await exportFigFile(graph)).slice().buffer)
    expect(
      [...restored.getAllNodes()]
        .filter((n) => n.name === 'Label')
        .map((n) => n.visible)
        .sort()
    ).toEqual([false, true, true])
    editor.unbindVariable(target.id, 'visible')
    expect(target.visible).toBe(true)
    editor.undo.undo()
    expect(target.visible).toBe(false)
  } finally {
    editor.dispose()
  }
})

test('exposing visibility moves its variable into the property default and undo restores the layer binding', async () => {
  const { editor, graph, variable, child, first } = setup()
  try {
    editor.bindVariable(child.id, 'visible', variable.id)
    await Promise.resolve()
    const property = editor.exposeComponentProperty(child.id, 'VISIBLE', 'Show label')
    expect(property).toBeTruthy()
    expect(child.boundVariables.visible).toBeUndefined()
    expect(
      graph
        .getNode(child.parentId ?? '')
        ?.componentPropertyDefinitions.find((d) => d.id === property)?.defaultVariableId
    ).toBe(variable.id)
    expect(child.boundVariables.visible).toBeUndefined()
    expect(graph.getChildren(first.id)[0].boundVariables.visible).toBeUndefined()
    editor.undo.undo()
    expect(child.componentPropertyReferences).toHaveLength(0)
    expect(child.boundVariables.visible).toBe(variable.id)
    expect(child.visible).toBe(false)
  } finally {
    editor.dispose()
  }
})
