import { expect, test } from 'bun:test'

import { SceneGraph, getWorldMatrix, TransformMatrix } from '@open-pencil/scene-graph'

for (const type of ['FRAME', 'GROUP', 'COMPONENT', 'INSTANCE'] as const) {
  test(`${type} exposes visible overflow and respects clipping and hidden descendants`, () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0].id
    const parent = graph.createNode(type, page, {
      x: 100,
      y: 100,
      width: 100,
      height: 80,
      clipsContent: false
    })
    const badge = graph.createNode('FRAME', parent.id, {
      x: 110,
      y: -40,
      width: 80,
      height: 40,
      clipsContent: false
    })
    const text = graph.createNode('TEXT', badge.id, {
      x: 10,
      y: 10,
      width: 50,
      height: 20,
      text: 'Badge'
    })
    expect(graph.hitTestDeep(230, 80, page)?.id).toBe(text.id)
    if (type !== 'FRAME') expect(graph.hitTest(230, 80, page)?.id).toBe(parent.id)
    graph.updateNode(parent.id, { clipsContent: true })
    expect(graph.hitTestDeep(230, 80, page)).toBeNull()
    graph.updateNode(parent.id, { clipsContent: false })
    graph.updateNode(badge.id, { visible: false })
    expect(graph.hitTestDeep(230, 80, page)).toBeNull()
    graph.updateNode(badge.id, { visible: true })
    graph.updateNode(parent.id, { rotation: 35, flipX: true })
    const [x, y] = TransformMatrix.mapPoints(getWorldMatrix(text, graph), [20, 10])
    expect(graph.hitTestDeep(x, y, page)?.id).toBe(text.id)
    graph.updateNode(parent.id, { clipsContent: true })
    expect(graph.hitTestDeep(x, y, page)).toBeNull()
  })
}
