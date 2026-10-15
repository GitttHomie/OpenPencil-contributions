import { expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { createEditor } from '#core/editor/create'
import { exportFigFile, parseFigFile } from '#core/io/index'
import { initCodec } from '#core/kiwi'

function setup() {
  const editor = createEditor()
  const graph = editor.graph
  const page = editor.state.currentPageId
  const collection = graph.createCollection('Visibility')
  const hidden = graph.createVariable('Hidden', 'BOOLEAN', collection.id, false)
  const main = graph.createNode('COMPONENT', page, {
    name: 'Control',
    width: 100,
    layoutMode: 'VERTICAL',
    primaryAxisSizing: 'HUG'
  })
  const child = graph.createNode('FRAME', main.id, { name: 'Content', width: 100, height: 40 })
  const property = expectDefined(
    editor.exposeComponentProperty(child.id, 'VISIBLE', 'Show content')
  )
  const first = expectDefined(graph.createInstance(main.id, page))
  const second = expectDefined(graph.createInstance(main.id, page))
  return { editor, graph, page, collection, hidden, main, child, property, first, second }
}

test('Boolean variable defaults inherit, preserve literal overrides, react to edits and undo', async () => {
  const { editor, graph, collection, hidden, main, child, property, first, second } = setup()
  try {
    editor.setInstanceComponentProperty(second.id, property, 'true')
    expect(editor.setComponentPropertyDefaultVariable(main.id, property, hidden.id)).toBe(true)
    await Promise.resolve()
    expect([
      child.visible,
      graph.getChildren(first.id)[0].visible,
      graph.getChildren(second.id)[0].visible
    ]).toEqual([false, false, true])
    expect([main.height, first.height, second.height]).toEqual([0, 0, 40])
    editor.updateVariableValue(hidden.id, collection.defaultModeId, true)
    expect(graph.getChildren(first.id)[0].visible).toBe(true)
    editor.undo.undo()
    expect(graph.getChildren(first.id)[0].visible).toBe(false)
    editor.undo.undo()
    await Promise.resolve()
    expect(main.componentPropertyDefinitions[0].defaultVariableId).toBeUndefined()
    expect(graph.getChildren(first.id)[0].visible).toBe(true)
    editor.undo.redo()
    await Promise.resolve()
    expect(graph.getChildren(first.id)[0].visible).toBe(false)
  } finally {
    editor.dispose()
  }
})

test('exposure moves a layer variable into the property default without flattening it', async () => {
  const { editor, graph, main, hidden, collection } = setup()
  try {
    const other = graph.createNode('FRAME', main.id, { name: 'Other' })
    editor.bindVariable(other.id, 'visible', hidden.id)
    const id = expectDefined(editor.exposeComponentProperty(other.id, 'VISIBLE', 'Show other'))
    expect(main.componentPropertyDefinitions.find((d) => d.id === id)?.defaultVariableId).toBe(
      hidden.id
    )
    expect(other.boundVariables.visible).toBeUndefined()
    editor.updateVariableValue(hidden.id, collection.defaultModeId, true)
    expect(other.visible).toBe(true)
    editor.undo.undo()
    editor.undo.undo()
    expect(other.boundVariables.visible).toBe(hidden.id)
    expect(other.componentPropertyReferences).toEqual([])
  } finally {
    editor.dispose()
  }
})

test('nested property variable defaults inherit through the parent and reset after local overrides', async () => {
  const { editor, graph, page, hidden, main, property, collection } = setup()
  try {
    const outer = graph.createNode('COMPONENT', page, { name: 'Outer' })
    const nested = expectDefined(graph.createInstance(main.id, outer.id))
    editor.setNestedComponentPropertyExposure(outer.id, nested.id, [property])
    const instance = expectDefined(graph.createInstance(outer.id, page))
    const definition = expectDefined(
      editor
        .getInstanceComponentPropertyDefinitions(instance.id)
        .find((d) => d.name.endsWith('Show content'))
    )
    editor.setInstanceComponentPropertyVariable(nested.id, property, hidden.id)
    await Promise.resolve()
    const occurrence = graph.getChildren(instance.id)[0]
    const target = graph.getChildren(occurrence.id)[0]
    expect(target.visible).toBe(false)
    editor.detachInstanceComponentPropertyVariable(instance.id, definition.id)
    editor.updateVariableValue(hidden.id, collection.defaultModeId, true)
    expect(target.visible).toBe(false)
    editor.resetInstanceComponentProperty(instance.id, definition.id)
    expect(target.visible).toBe(true)
    editor.updateVariableValue(hidden.id, collection.defaultModeId, false)
    expect(target.visible).toBe(false)
  } finally {
    editor.dispose()
  }
})

test('variable defaults and nested variable assignments survive complete and patched .fig saves', async () => {
  const { editor, graph, main, property, hidden, first } = setup()
  try {
    await initCodec()
    editor.setComponentPropertyDefaultVariable(main.id, property, hidden.id)
    editor.setInstanceComponentPropertyVariable(first.id, property, hidden.id)
    await Promise.resolve()
    for (let round = 0, current = graph; round < 2; round++) {
      current = await parseFigFile((await exportFigFile(current)).slice().buffer)
      const component = expectDefined(
        [...current.getAllNodes()].find((n) => n.type === 'COMPONENT' && n.name === 'Control')
      )
      const variable = expectDefined(
        [...current.variables.values()].find((v) => v.name === 'Hidden')
      )
      expect(component.componentPropertyDefinitions[0].defaultVariableId).toBe(variable.id)
      const instances = [...current.getAllNodes()].filter((n) => n.type === 'INSTANCE')
      expect(
        instances.some((n) =>
          Object.values(n.componentPropertyVariableAssignments).includes(variable.id)
        )
      ).toBe(true)
      expect(instances.map((n) => current.getChildren(n.id)[0].visible)).toEqual([false, false])
    }
  } finally {
    editor.dispose()
  }
})

test('different occurrence modes resolve the same property default independently', async () => {
  const { editor, graph, collection, hidden, main, property, first, second } = setup()
  try {
    const mode = 'shown'
    graph.addMode(collection.id, mode, 'Shown')
    editor.updateVariableValue(hidden.id, mode, true)
    editor.updateNodeWithUndo(second.id, { variableModes: { [collection.id]: mode } })
    editor.setComponentPropertyDefaultVariable(main.id, property, hidden.id)
    await Promise.resolve()
    expect([
      graph.getChildren(first.id)[0].visible,
      graph.getChildren(second.id)[0].visible
    ]).toEqual([false, true])
    const other = graph.createNode('FRAME', main.id, { name: 'Another target', height: 20 })
    editor.bindComponentProperty(other.id, 'VISIBLE', property)
    await Promise.resolve()
    expect(graph.getChildren(first.id).map((n) => n.visible)).toEqual([false, false])
    expect(graph.getChildren(second.id).map((n) => n.visible)).toEqual([true, true])
  } finally {
    editor.dispose()
  }
})

test('editing a reopened default patches the variable reference and reset remains inherited after saving', async () => {
  const { editor, graph, main, property, hidden, first } = setup()
  try {
    await initCodec()
    editor.setComponentPropertyDefaultVariable(main.id, property, hidden.id)
    editor.setInstanceComponentPropertyVariable(first.id, property, hidden.id)
    await Promise.resolve()
    const reopened = await parseFigFile((await exportFigFile(graph)).slice().buffer)
    const editing = createEditor({ graph: reopened, skipInitialGraphSetup: true })
    try {
      const component = expectDefined(
        [...reopened.getAllNodes()].find((n) => n.type === 'COMPONENT' && n.name === 'Control')
      )
      const definition = component.componentPropertyDefinitions[0]
      const variable = expectDefined(
        [...reopened.variables.values()].find((v) => v.name === 'Hidden')
      )
      const shown = reopened.createVariable('Shown', 'BOOLEAN', variable.collectionId, true)
      const instance = expectDefined(
        [...reopened.getAllNodes()].find(
          (n) =>
            n.type === 'INSTANCE' && Object.keys(n.componentPropertyVariableAssignments).length > 0
        )
      )
      editing.setComponentPropertyDefaultVariable(component.id, definition.id, shown.id)
      editing.resetInstanceComponentProperty(instance.id, definition.id)
      await Promise.resolve()
      const final = await parseFigFile((await exportFigFile(reopened)).slice().buffer)
      const savedComponent = expectDefined(
        [...final.getAllNodes()].find((n) => n.type === 'COMPONENT' && n.name === 'Control')
      )
      const savedVariable = expectDefined(
        [...final.variables.values()].find((v) => v.name === 'Shown')
      )
      expect(savedComponent.componentPropertyDefinitions[0].defaultVariableId).toBe(
        savedVariable.id
      )
      for (const node of final.getAllNodes()) {
        if (node.type !== 'INSTANCE') continue
        expect(node.componentPropertyVariableAssignments).toEqual({})
        expect(node.componentPropertyAssignments).toEqual({})
        expect(final.getChildren(node.id)[0].visible).toBe(true)
      }
    } finally {
      editing.dispose()
    }
  } finally {
    editor.dispose()
  }
})

test('new targets inherit a nested variable assignment and deleting the property removes it', async () => {
  const { editor, graph, main, property, hidden, first, second } = setup()
  try {
    editor.setInstanceComponentPropertyVariable(first.id, property, hidden.id)
    const other = graph.createNode('FRAME', main.id, { name: 'Another target', height: 20 })
    editor.bindComponentProperty(other.id, 'VISIBLE', property)
    await Promise.resolve()
    expect(graph.getChildren(first.id).map((node) => node.visible)).toEqual([false, false])
    expect(graph.getChildren(second.id).map((node) => node.visible)).toEqual([true, true])
    editor.deleteComponentProperty(main.id, property)
    expect(first.componentPropertyVariableAssignments).toEqual({})
    editor.undo.undo()
    expect(first.componentPropertyVariableAssignments[property]).toBe(hidden.id)
  } finally {
    editor.dispose()
  }
})

test('saved nested defaults remain inherited when the containing component changes its variable', async () => {
  const { editor, graph, page, main, property, hidden } = setup()
  try {
    await initCodec()
    const outer = graph.createNode('COMPONENT', page, { name: 'Outer' })
    const nested = expectDefined(graph.createInstance(main.id, outer.id))
    editor.setNestedComponentPropertyExposure(outer.id, nested.id, [property])
    editor.setInstanceComponentPropertyVariable(nested.id, property, hidden.id)
    const instance = expectDefined(graph.createInstance(outer.id, page))
    await Promise.resolve()
    const reopened = await parseFigFile((await exportFigFile(graph)).slice().buffer)
    const editing = createEditor({ graph: reopened })
    try {
      const source = expectDefined(
        [...reopened.getAllNodes()].find(
          (node) =>
            node.type === 'INSTANCE' &&
            !!node.parentId &&
            reopened.getNode(node.parentId)?.type === 'COMPONENT'
        )
      )
      const ownProperty = expectDefined(
        editing.getInstanceComponentPropertyDefinitions(source.id)[0]
      )
      const variable = expectDefined(
        [...reopened.variables.values()].find((value) => value.name === 'Hidden')
      )
      const shown = reopened.createVariable('Shown', 'BOOLEAN', variable.collectionId, true)
      editing.setInstanceComponentPropertyVariable(source.id, ownProperty.id, shown.id)
      await Promise.resolve()
      const occurrence = expectDefined(
        [...reopened.getAllNodes()].find(
          (node) => node.type === 'INSTANCE' && node.name === instance.name
        )
      )
      const target = reopened.getChildren(reopened.getChildren(occurrence.id)[0].id)[0]
      expect(target.visible).toBe(true)
    } finally {
      editing.dispose()
    }
  } finally {
    editor.dispose()
  }
})
