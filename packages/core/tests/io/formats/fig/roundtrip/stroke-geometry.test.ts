import { beforeAll, describe, expect, setDefaultTimeout, test } from 'bun:test'

import { collectAllNodes } from '#core-tests/helpers/fig/traversal'

import { exportFigFile, initCodec, parseFigFile, SceneGraph } from '@open-pencil/core'
import { recordInstanceOverride } from '@open-pencil/scene-graph'

setDefaultTimeout(60_000)

describe('roundtrip: stroke geometry without strokes', () => {
  beforeAll(async () => {
    await initCodec()
  })

  test('component stroke defaults synchronize while saved instance overrides stay independent', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const main = graph.createNode('COMPONENT', page.id, { name: 'Main', strokeWeight: 2 })
    const instance = graph.createInstance(main.id, page.id, { name: 'Override' })
    if (!instance) throw new Error('Instance unavailable')
    graph.updateNode(main.id, { strokeWeight: 4, strokeAlign: 'OUTSIDE' })
    graph.syncInstances(main.id)
    expect([instance.strokeWeight, instance.strokeAlign]).toEqual([4, 'OUTSIDE'])
    graph.updateNode(instance.id, { strokeWeight: 7, strokeAlign: 'CENTER' })
    recordInstanceOverride(graph, instance.id, ['strokeWeight', 'strokeAlign'])
    graph.updateNode(main.id, { strokeWeight: 3, strokeAlign: 'INSIDE' })
    graph.syncInstances(main.id)
    expect([instance.strokeWeight, instance.strokeAlign]).toEqual([7, 'CENTER'])
    const restored = await parseFigFile((await exportFigFile(graph)).slice().buffer)
    const nodes = collectAllNodes(restored)
    const saved = nodes.find((node) => node.type === 'INSTANCE')
    const savedMain = nodes.find((node) => node.type === 'COMPONENT')
    if (!saved || !savedMain) throw new Error('Missing round-tripped component')
    expect([saved.strokeWeight, saved.strokeAlign]).toEqual([7, 'CENTER'])
    restored.updateNode(savedMain.id, { strokeWeight: 9 })
    restored.syncInstances(savedMain.id)
    expect(saved.strokeWeight).toBe(7)
  })

  test('a weight and alignment kept without strokes survive export and re-import', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    graph.createNode('RECTANGLE', page.id, {
      name: 'Kept',
      strokes: [],
      strokeWeight: 5,
      strokeAlign: 'OUTSIDE'
    })
    graph.createNode('RECTANGLE', page.id, { name: 'Default', strokes: [] })

    const bytes = await exportFigFile(graph)
    const nodes = collectAllNodes(await parseFigFile(bytes.buffer as ArrayBuffer))
    const kept = nodes.find((node) => node.name === 'Kept')
    expect([kept?.strokeWeight, kept?.strokeAlign]).toEqual([5, 'OUTSIDE'])
    const plain = nodes.find((node) => node.name === 'Default')
    expect([plain?.strokeWeight, plain?.strokeAlign]).toEqual([1, 'INSIDE'])
  })
})
