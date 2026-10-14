import { expect, test } from 'bun:test'

import { SceneGraph, withIcon } from '@open-pencil/scene-graph'

import { LabelCache } from '#core/canvas/labels/cache'

test('top-level icons retain clickable names alongside frames', () => {
  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id
  const frame = graph.createNode('FRAME', pageId, { name: 'Card', width: 200, height: 100 })
  const icon = graph.createNode('FRAME', pageId, { name: 'cat', x: 300, width: 24, height: 24 })
  graph.updateNode(icon.id, { pluginData: withIcon(icon, { name: 'mdi:cat' }) })

  const cache = new LabelCache()
  cache.update(graph, pageId, 1)

  expect(cache.getAllFrames().map(({ nodeId }) => nodeId)).toEqual([frame.id, icon.id])
})
