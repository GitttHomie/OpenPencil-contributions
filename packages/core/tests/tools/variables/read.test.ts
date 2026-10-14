import { expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { FigmaAPI } from '#core/figma-api'
import { findVariables, getVariable, listVariables } from '#core/tools/variables/read'

test('compact token discovery keeps binding IDs and mode values without import metadata', () => {
  const graph = new SceneGraph()
  const variable = {
    id: 'space',
    name: 'Spacing/section',
    type: 'FLOAT' as const,
    collectionId: 'spacing',
    valuesByMode: { desktop: 80, mobile: 24 },
    description: 'Section spacing',
    hiddenFromPublishing: false,
    pluginData: [{ pluginId: 'test', key: 'metadata', value: 'large payload' }]
  }
  graph.addVariable(variable)
  const figma = new FigmaAPI(graph)
  const compact = {
    count: 1,
    variables: [
      {
        id: 'space',
        name: 'Spacing/section',
        type: 'FLOAT',
        collectionId: 'spacing',
        valuesByMode: { desktop: 80, mobile: 24 }
      }
    ]
  }
  expect(listVariables.execute(figma, { type: 'FLOAT', compact: true })).toEqual(compact)
  expect(findVariables.execute(figma, { query: 'section', type: 'FLOAT', compact: true })).toEqual(
    compact
  )
  expect(getVariable.execute(figma, { id: 'space' })).toEqual(variable)
})
