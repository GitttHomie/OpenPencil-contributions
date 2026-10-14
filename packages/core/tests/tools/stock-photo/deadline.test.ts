import { expect, test } from 'bun:test'

import { copyFills, SceneGraph } from '@open-pencil/scene-graph'

import { FigmaAPI } from '#core/figma-api'
import { applyPhoto } from '#core/tools/stock-photo/apply'
import type { StockPhotoResult } from '#core/tools/stock-photo/providers'

test('a stalled provider releases the call and cannot apply an image after its deadline', async () => {
  const graph = new SceneGraph()
  const target = graph.createNode('FRAME', graph.getPages()[0].id)
  const initialFills = copyFills(target.fills)
  const pending = Promise.withResolvers<StockPhotoResult[]>()
  let signal: AbortSignal | undefined
  const result = await applyPhoto(
    new FigmaAPI(graph),
    {
      name: 'delayed',
      search: (_query, options) => {
        signal = options.signal
        return pending.promise
      }
    },
    { id: target.id, query: 'house' },
    10
  )
  expect(result).toHaveProperty('error')
  expect(result.error).toContain('Photo access timed out before placement')
  expect(signal?.aborted).toBe(true)
  pending.resolve([
    {
      url: 'https://invalid.example/never-fetch.png',
      width: 100,
      height: 100,
      photographer: 'Test',
      sourceId: 'test'
    }
  ])
  await Promise.resolve()
  await Promise.resolve()
  expect(target.fills).toEqual(initialFills)
  expect(graph.images.size).toBe(0)
})
