import { expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { FigmaAPI } from '#core/figma-api'
import { DESIGN_WORKFLOW, getDesignGuidance } from '#core/tools/design-guidance'
import { CORE_TOOLS } from '#core/tools/registry'
import { isToolExposed } from '#core/tools/schema'

test('guidance discovery is shared, read-only, and does not require external capabilities', () => {
  const graph = new SceneGraph()
  const figma = new FigmaAPI(graph)
  const before = structuredClone([...graph.nodes.values()])
  const result = getDesignGuidance.execute(figma, {})

  expect(CORE_TOOLS).toContain(getDesignGuidance)
  for (const target of ['ai', 'mcp', 'webmcp'] as const) {
    expect(isToolExposed(getDesignGuidance, target)).toBe(true)
  }
  expect(getDesignGuidance.mutates).toBe(false)
  expect(getDesignGuidance.capabilities).toEqual([])
  expect(result).toMatchObject({
    version: '1.1.0',
    workflow: DESIGN_WORKFLOW,
    available: [
      { topic: 'ux' },
      { topic: 'visual' },
      { topic: 'design-system' },
      { topic: 'review' },
      { topic: 'creation' }
    ],
    guidance: []
  })
  expect([...graph.nodes.values()]).toEqual(before)
})

test('guidance retrieves only requested topics and deduplicates repeated selections', () => {
  const figma = new FigmaAPI(new SceneGraph())
  expect(
    getDesignGuidance.execute(figma, { topics: ['design-system', 'ux', 'design-system'] })
  ).toMatchObject({
    workflow: DESIGN_WORKFLOW,
    guidance: [
      { topic: 'design-system', content: expect.any(String) },
      { topic: 'ux', content: expect.any(String) }
    ]
  })
})

test('guidance rejects unknown topics and oversized requests through its public schema', () => {
  const figma = new FigmaAPI(new SceneGraph())
  expect(() => getDesignGuidance.execute(figma, { topics: ['install-packages'] })).toThrow()
  expect(() =>
    getDesignGuidance.execute(figma, { topics: ['ux', 'ux', 'ux', 'ux', 'ux', 'ux'] })
  ).toThrow()
})
