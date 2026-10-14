import { expect, test, spyOn } from 'bun:test'

import { SceneGraph, prepareVariableTransfer } from '@open-pencil/scene-graph'

import { createEditor } from '#core/editor'
import { exportFigFile, parseFigFile } from '#core/io/formats/fig'
import { extractExportGraph } from '#core/io/subgraph'
import { getTextMeasurer, setTextMeasurer } from '#core/layout'
import { fontManager } from '#core/text/fonts'

function setup(weight = 700) {
  const graph = new SceneGraph()
  const text = graph.createNode('TEXT', graph.getPages()[0].id, {
    text: 'Typography',
    fontFamily: 'Inter',
    fontWeight: weight
  })
  const loads: string[] = []
  const editor = createEditor({
    graph,
    loadFont: async (family, style) => {
      loads.push(`${family}/${style}`)
      return null
    }
  })
  return { graph, text, editor, loads }
}

test('a weight variable creates and binds its family, with one undo step', () => {
  const { graph, text, editor } = setup()
  const weight = editor.createFontVariable(text.id, 'fontWeight', 'Body weight')
  const familyId = graph.variables.get(weight)?.fontFamilyVariableId
  expect(familyId).toBeTruthy()
  expect(text.boundVariables).toEqual({ fontFamily: familyId, fontWeight: weight })
  expect(familyId && graph.resolveVariable(familyId)).toBe('Inter')
  expect(graph.resolveVariable(weight)).toBe(700)
  editor.undo.undo()
  expect(graph.variables.size).toBe(0)
  expect(text.boundVariables).toEqual({})
  editor.undo.redo()
  expect(text.boundVariables).toEqual({ fontFamily: familyId, fontWeight: weight })
  editor.dispose()
})

test('font variables update typography, load faces, retain styles and undo', async () => {
  const { graph, text, editor, loads } = setup()
  const styleId = editor.createTextStyle(text.id, 'Body')
  const weightId = editor.createFontVariable(text.id, 'fontWeight', 'Weight')
  const weight = graph.variables.get(weightId)
  if (!weight?.fontFamilyVariableId) throw new Error('Missing weight pair')
  const mode = graph.variableCollections.get(weight.collectionId)?.defaultModeId
  if (!mode) throw new Error('Missing mode')
  editor.updateVariableValue(weightId, mode, 800)
  expect(text.fontWeight).toBe(800)
  expect(text.textStyleId).toBe(styleId)
  expect(loads).toContain('Inter/ExtraBold')
  editor.updateVariableValue(weight.fontFamilyVariableId, mode, 'Test Font')
  expect(text.fontFamily).toBe('Test Font')
  expect(loads).toContain('Test Font/ExtraBold')
  editor.undo.undo()
  expect(text.fontFamily).toBe('Inter')
  editor.undo.undo()
  expect(text.fontWeight).toBe(700)
  await Promise.resolve()
  editor.dispose()
})

test('font family and weight references survive .fig and isolated resource transfer', async () => {
  const { graph, text, editor } = setup()
  const weightId = editor.createFontVariable(text.id, 'fontWeight', 'Weight')
  const weight = graph.variables.get(weightId)
  if (!weight?.fontFamilyVariableId) throw new Error('Missing weight pair')
  const bytes = await exportFigFile(graph)
  const reopened = await parseFigFile(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  )
  const restored = [...reopened.variables.values()].find((variable) => variable.name === 'Weight')
  expect(
    restored?.fontFamilyVariableId && reopened.resolveVariable(restored.fontFamilyVariableId)
  ).toBe('Inter')
  graph.createVariable('Unrelated', 'FLOAT', weight.collectionId, 12)
  const copy = extractExportGraph(graph, { scope: 'node', nodeId: text.id })
  expect(copy.graph.variables.size).toBe(2)
  const variables = [...graph.variables.values()]
  const collections = [...graph.variableCollections.values()]
  const transferred = prepareVariableTransfer(variables, collections, {
    variables: new Map(variables.map((variable) => [variable.id, `copy:${variable.id}`])),
    collections: new Map(collections.map((collection) => [collection.id, `copy:${collection.id}`])),
    modes: new Map(
      collections.flatMap((collection) =>
        collection.modes.map((mode) => [mode.modeId, `copy:${mode.modeId}`])
      )
    )
  })
  expect(
    transferred.variables.find((variable) => variable.name === 'Weight')?.fontFamilyVariableId
  ).toBe(`copy:${weight.fontFamilyVariableId}`)
  editor.dispose()
})

test('cached font changes resize standalone auto-width text and preserve fixed text boxes', async () => {
  const previous = getTextMeasurer()
  const { graph, text, editor } = setup(400)
  setTextMeasurer((node) => ({ width: node.fontWeight === 700 ? 180 : 140, height: 24 }))
  try {
    graph.updateNode(text.id, { textAutoResize: 'WIDTH_AND_HEIGHT', width: 140, height: 24 })
    const variableId = editor.createFontVariable(text.id, 'fontWeight', 'Body')
    const variable = graph.variables.get(variableId)
    const mode = variable && graph.variableCollections.get(variable.collectionId)?.defaultModeId
    if (!mode) throw new Error('Missing mode')
    editor.updateVariableValue(variableId, mode, 700)
    await new Promise<void>((resolve) => {
      queueMicrotask(() => queueMicrotask(resolve))
    })
    expect(text.width).toBe(180)
    expect(text.height).toBe(24)
    graph.updateNode(text.id, { textAutoResize: 'NONE', width: 240, height: 60 })
    editor.updateVariableValue(variableId, mode, 400)
    await new Promise<void>((resolve) => {
      queueMicrotask(() => queueMicrotask(resolve))
    })
    expect(text.width).toBe(240)
    expect(text.height).toBe(60)
  } finally {
    editor.dispose()
    setTextMeasurer(previous)
  }
})

test('creating a weight outside the known family faces leaves no variables behind', () => {
  const { graph, text, editor } = setup(37)
  const catalog = spyOn(fontManager, 'familyStyles').mockReturnValue(['Regular', 'Bold'])
  try {
    expect(() => editor.createFontVariable(text.id, 'fontWeight', 'Invalid')).toThrow(
      'selected weight'
    )
    expect(graph.variables.size).toBe(0)
  } finally {
    catalog.mockRestore()
    editor.dispose()
  }
})
