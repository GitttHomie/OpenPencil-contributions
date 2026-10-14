import { expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { FigmaAPI } from '#core/figma-api'
import { isToolExposed } from '#core/tools/schema'
import { groupNodes, reparentNode, ungroupNode } from '#core/tools/structure/hierarchy'

test('agents cannot discover group creation, while imported groups remain editable', () => {
  for (const target of ['ai', 'mcp', 'webmcp'] as const) {
    expect(isToolExposed(groupNodes, target)).toBe(false)
    expect(isToolExposed(ungroupNode, target)).toBe(true)
  }
})

test('reparenting within one parent reorders sections and reports the actual index', () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const nodes = ['Hero', 'FAQ', 'Features'].map((name) =>
    graph.createNode('FRAME', page.id, { name })
  )
  const figma = new FigmaAPI(graph)
  expect(
    reparentNode.execute(figma, { id: nodes[2].id, parent_id: page.id, index: 1 })
  ).toMatchObject({ index: 1 })
  expect(graph.getChildren(page.id).map((node) => node.name)).toEqual(['Hero', 'Features', 'FAQ'])
  reparentNode.execute(figma, { id: nodes[0].id, parent_id: page.id })
  expect(graph.getChildren(page.id).map((node) => node.name)).toEqual(['Features', 'FAQ', 'Hero'])
})
