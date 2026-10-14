import { expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { FigmaAPI } from '#core/figma-api'
import { analyzeSpacing } from '#core/tools/analyze/spacing'
import { describe } from '#core/tools/describe'

test('spacing reports combined wrapper whitespace without prescribing a grid', () => {
  const graph = new SceneGraph()
  const screen = graph.createNode('FRAME', graph.getPages()[0].id, {
    width: 600,
    height: 600,
    layoutMode: 'VERTICAL',
    itemSpacing: 0
  })
  for (const y of [0, 300]) {
    const section = graph.createNode('FRAME', screen.id, {
      y,
      width: 600,
      height: 300,
      layoutMode: 'VERTICAL',
      paddingTop: 80,
      paddingBottom: 80
    })
    graph.createNode('FRAME', section.id, { y: 80, width: 600, height: 140 })
  }
  graph.createNode('FRAME', graph.getPages()[0].id, { layoutMode: 'VERTICAL', itemSpacing: 777 })
  const figma = new FigmaAPI(graph)
  expect(analyzeSpacing.execute(figma, { id: screen.id })).toMatchObject({
    totalNodes: 5,
    gridSize: null,
    offGridGaps: [],
    layouts: expect.arrayContaining([
      expect.objectContaining({
        id: screen.id,
        pairs: [expect.objectContaining({ boxGap: 0, innerContentGap: 160 })]
      })
    ])
  })
  graph.updateNode(screen.id, { itemSpacing: 12 })
  const neutral = JSON.stringify(describe.execute(figma, { id: screen.id }))
  expect(neutral).not.toContain('grid')
  const checked = JSON.stringify(describe.execute(figma, { id: screen.id, grid: 8 }))
  expect(checked).toContain('not on 8px grid')
  expect(analyzeSpacing.execute(figma, { id: screen.id, grid: 8 })).toMatchObject({
    offGridGaps: [12]
  })
})
