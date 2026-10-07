import { describe, expect, spyOn, test } from 'bun:test'

import { fontManager } from '@open-pencil/core/text'
import { SceneGraph } from '@open-pencil/scene-graph'

import { ensureGraphFonts } from '@/app/editor/fonts'
import { createDeferred } from '@/app/runtime/deferred'

import { expectDefined } from '#tests/helpers/assert'
import { repoPath } from '#tests/helpers/paths'

describe('live edit font loading', () => {
  test.each(['loaded', 'failed'] as const)(
    'keeps existing frames drawable while fonts are pending and then %s',
    async (outcome) => {
      const data = await Bun.file(repoPath('public/Inter-Regular.ttf')).arrayBuffer()
      fontManager.markLoaded('Inter', 'Regular', data)
      const graph = new SceneGraph()
      const page = expectDefined(graph.getPages()[0], 'page')
      const frame = graph.createNode('FRAME', page.id)
      graph.createNode('TEXT', frame.id, { text: 'Existing content', fontFamily: 'Inter' })
      const gate = createDeferred<ArrayBuffer | null>()
      const load = spyOn(fontManager, 'loadFont').mockImplementation(() => gate.promise)
      let invalidations = 0
      const pending = ensureGraphFonts(graph, [frame.id], {
        invalidateAllPictures: () => invalidations++
      })
      // Attach a rejection handler before releasing the failed load.
      const settled = pending.then(
        () => 'loaded',
        () => 'failed'
      )
      try {
        expect(fontManager.isNodeBlocked(frame.id)).toBe(false)
        if (outcome === 'loaded') gate.resolve(data)
        else gate.reject(new Error('Font unavailable'))
        expect(await settled).toBe(outcome)
        expect(fontManager.isNodeBlocked(frame.id)).toBe(false)
        expect(invalidations).toBe(1)
      } finally {
        gate.resolve(data)
        await settled
        load.mockRestore()
      }
    }
  )

  test('does not release a block owned by document preparation', async () => {
    const graph = new SceneGraph()
    const page = expectDefined(graph.getPages()[0], 'page')
    const frame = graph.createNode('FRAME', page.id)
    fontManager.blockNodesUntilFontsResolve([frame.id])
    try {
      await ensureGraphFonts(graph, [frame.id])
      expect(fontManager.isNodeBlocked(frame.id)).toBe(true)
    } finally {
      fontManager.unblockNodes([frame.id])
    }
  })
})
