import { expect, test } from 'bun:test'

import { getSharedStyles, SceneGraph } from '@open-pencil/scene-graph'

import { createEditor } from '#core/editor'
import { exportFigFile, parseFigFile, populateFigPage } from '#core/io/formats/fig'
import { deserializeSceneGraph, serializeSceneGraph } from '#core/kiwi/fig/parse/transfer'
import { registerReaderRecovery } from '#core/kiwi/fig/session/document-state'
import { openReaderSession } from '#core/kiwi/fig/session/reader'

test('saving a plain OpenPencil document does not create an internal page', async () => {
  const graph = new SceneGraph()
  graph.createNode('FRAME', graph.getPages()[0].id, { name: 'Screen' })
  const bytes = await exportFigFile(graph)
  const reopened = await parseFigFile(bytes.slice().buffer as ArrayBuffer)
  expect(reopened.getPages(true)).toHaveLength(1)
})

test('resource-only internal pages stay out of navigation without losing styles or variables', async () => {
  const editor = createEditor()
  const collection = editor.graph.createCollection('Type')
  const variable = editor.graph.createVariable('Size', 'FLOAT', collection.id, 24)
  const text = editor.graph.createNode('TEXT', editor.state.currentPageId, {
    text: 'Title',
    fontSize: 24,
    boundVariables: { fontSize: variable.id }
  })
  editor.createTextStyle(text.id, 'Heading')
  const bytes = await exportFigFile(editor.graph)
  editor.dispose()
  const reopened = await parseFigFile(bytes.slice().buffer as ArrayBuffer)
  const restored = createEditor({ graph: reopened })
  try {
    expect(reopened.getPages(true)).toHaveLength(2)
    expect(restored.getNavigablePages(true).map((page) => page.name)).toEqual(['Page 1'])
    expect(reopened.variables.size).toBe(1)
    expect(getSharedStyles(reopened, 'text')).toHaveLength(1)
    const savedAgain = await exportFigFile(reopened)
    const again = await parseFigFile(savedAgain.slice().buffer as ArrayBuffer)
    expect(again.variables.size).toBe(1)
    expect(getSharedStyles(again, 'text')).toHaveLength(1)
  } finally {
    restored.dispose()
  }
})

test('unpopulated internal design pages remain reachable through worker checkpoints', async () => {
  const source = new SceneGraph()
  const empty = source.addPage('Empty internal')
  const library = source.addPage('Embedded components')
  source.updateNode(empty.id, { internalOnly: true })
  source.updateNode(library.id, { internalOnly: true })
  source.createNode('COMPONENT', library.id, { name: 'Button' })
  const bytes = (await exportFigFile(source)).slice().buffer as ArrayBuffer
  const backend = openReaderSession(bytes, 'first-page')
  const graph = deserializeSceneGraph(serializeSceneGraph(backend.graph))
  registerReaderRecovery(graph, bytes, backend.checkpoint())
  const editor = createEditor({ graph })
  try {
    const page = graph.getPages(true).find((page) => page.name === 'Embedded components')
    if (!page) throw new Error('Missing internal page')
    expect(page.childIds).toEqual([])
    expect(editor.getNavigablePages(true).map((page) => page.name)).toEqual([
      'Page 1',
      'Embedded components'
    ])
    expect(populateFigPage(graph, page.id)).toBe(true)
    expect(graph.getChildren(page.id)[0]?.name).toBe('Button')
    graph.deleteNode(page.childIds[0])
    expect(editor.getNavigablePages(true).map((page) => page.name)).toEqual(['Page 1'])
    expect(graph.getPages(true)).toHaveLength(3)
  } finally {
    editor.dispose()
  }
})
