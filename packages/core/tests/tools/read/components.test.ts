import { beforeAll, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import { FigmaAPI } from '@open-pencil/core/figma-api'
import { exportFigFile } from '@open-pencil/core/io'
import { parseFigFile } from '@open-pencil/core/io/formats/fig'
import { initCodec } from '@open-pencil/core/kiwi'
import { SceneGraph } from '@open-pencil/scene-graph'

import { deserializeSceneGraph, serializeSceneGraph } from '#core/kiwi/fig/parse/transfer'
import { registerReaderRecovery } from '#core/kiwi/fig/session/document-state'
import { openReaderSession } from '#core/kiwi/fig/session/reader'
import { registerComponentPageLoader } from '#core/tools/component-catalog'
import { getComponents } from '#core/tools/read/components'

beforeAll(() => initCodec())

async function fixture() {
  const source = new SceneGraph()
  source.createNode('COMPONENT', source.getPages()[0].id, { name: 'Button' })
  const page = source.addPage('Sections')
  const set = source.createNode('COMPONENT_SET', page.id, {
    name: 'Hero',
    componentPropertyDefinitions: [
      { id: '10:500', name: 'Device', type: 'VARIANT', defaultValue: 'Desktop' }
    ]
  })
  source.createNode('COMPONENT', set.id, {
    name: 'Device=Desktop',
    componentPropertyValues: { Device: 'Desktop' }
  })
  source.createNode('COMPONENT', source.addPage('Unrelated').id, { name: 'Footer' })
  return (await exportFigFile(source)).slice().buffer as ArrayBuffer
}

for (const recovery of [false, true]) {
  test(`component search discovers unopened sets without loading unrelated pages (recovery=${recovery})`, async () => {
    const bytes = await fixture()
    let graph: SceneGraph
    if (recovery) {
      const reader = openReaderSession(bytes, 'first-page')
      graph = deserializeSceneGraph(serializeSceneGraph(reader.graph))
      registerReaderRecovery(graph, bytes, reader.checkpoint())
    } else {
      graph = await parseFigFile(bytes, { populate: 'first-page' })
    }
    const figma = new FigmaAPI(graph)
    const originalPage = figma.currentPageId
    const sections = graph.getPages().find((page) => page.name === 'Sections')
    const unrelated = graph.getPages().find((page) => page.name === 'Unrelated')
    if (!sections || !unrelated) throw new Error('Missing fixture pages')
    expect(sections.childIds).toHaveLength(0)
    const result = await getComponents.execute(figma, { name: 'Hero', include_variants: true })
    expect(result).toMatchObject({
      count: 1,
      components: [
        {
          name: 'Hero',
          type: 'COMPONENT_SET',
          page: 'Sections',
          variantCount: 1,
          variants: [
            {
              id: expect.any(String),
              name: 'Device=Desktop',
              width: expect.any(Number),
              height: expect.any(Number)
            }
          ]
        }
      ]
    })
    expect(sections.childIds.length).toBeGreaterThan(0)
    expect(unrelated.childIds).toHaveLength(0)
    expect(figma.currentPageId).toBe(originalPage)
    const set = graph.getChildren(sections.id).find((node) => node.name === 'Hero')
    if (!set) throw new Error('Missing discovered set')
    graph.updateNode(set.id, { name: 'Renamed Hero' })
    expect(await getComponents.execute(figma, { name: 'Renamed Hero' })).toMatchObject({ count: 1 })
    graph.deleteNode(set.id)
    expect(await getComponents.execute(figma, { name: 'Hero' })).toMatchObject({ count: 0 })
    expect(unrelated.childIds).toHaveLength(0)
  })
}

test('host loader prepares matching pages without switching the editor or adding history', async () => {
  const editor = createEditor()
  const graph = await parseFigFile(await fixture(), { populate: 'first-page' })
  editor.replaceGraph(graph)
  const figma = new FigmaAPI(graph)
  const loaded: string[] = []
  registerComponentPageLoader(figma, async (id) => {
    loaded.push(id)
    await editor.loadPageNodes(id)
  })
  const originalPage = editor.state.currentPageId
  expect(await getComponents.execute(figma, { name: 'Hero' })).toMatchObject({ count: 1 })
  expect(loaded).toHaveLength(1)
  expect(graph.getNode(loaded[0])?.name).toBe('Sections')
  expect(editor.state.currentPageId).toBe(originalPage)
  expect(editor.undo.canUndo).toBe(false)
  await getComponents.execute(figma, { name: 'Hero' })
  expect(loaded).toHaveLength(1)
  editor.dispose()
})
