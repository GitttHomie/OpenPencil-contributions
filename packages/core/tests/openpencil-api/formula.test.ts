import { expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { compileScript } from '@open-pencil/core/tools'
import { SceneGraph } from '@open-pencil/scene-graph'

test('AI scripts author formulas through the same validation as the inspector', async () => {
  const graph = new SceneGraph()
  const collection = graph.createCollection('Tokens')
  graph.createVariable('base', 'FLOAT', collection.id, 4)
  const gap = graph.createVariable('gap', 'FLOAT', collection.id, 0)
  graph.createVariable('enabled', 'BOOLEAN', collection.id, true)
  const visible = graph.createVariable('visible', 'BOOLEAN', collection.id, false)
  const figma = new FigmaAPI(graph)
  const result = await compileScript(`
    return [
      openpencil.setVariableFormula('Tokens', 'gap', '{base} * 2'),
      openpencil.setVariableFormula('Tokens', 'visible', 'NOT {enabled}')
    ]
  `)(figma)
  expect(result).toEqual([8, false])
  expect(graph.resolveVariable(gap.id)).toBe(8)
  expect(graph.resolveVariable(visible.id)).toBe(false)
  expect(
    compileScript(`openpencil.setVariableFormula('Tokens', 'gap', '1 / 0')`)(figma)
  ).rejects.toThrow()
  expect(graph.resolveVariable(gap.id)).toBe(8)
})
