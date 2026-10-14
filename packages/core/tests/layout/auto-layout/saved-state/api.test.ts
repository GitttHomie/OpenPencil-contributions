import { expect, test } from 'bun:test'

import { FigmaAPI } from '#core/figma-api'

import { savedLayoutScenario } from './fixture'

for (const state of ['reopened', 'retained'] as const) {
  test(`${state}: headless API geometry reads see gap, padding and text changes`, async () => {
    const s = await savedLayoutScenario('frame', state)
    try {
      const target = s.target()
      const titleId = s.node('Title', s.node('Body')).id
      s.editor.dispose()
      const api = new FigmaAPI(s.graph)
      const frame = api.getNodeById(target.id)
      const text = api.getNodeById(titleId)
      if (!frame || !text) throw new Error('Fixture unavailable')
      frame.itemSpacing = 20
      expect(frame.height).toBe(88)
      frame.paddingLeft = 0
      expect(frame.children[0].x).toBe(0)
      text.characters = 'A'.repeat(80)
      expect(frame.height).toBe(128)
      frame.itemSpacing = 0
      expect(frame.height).toBe(108)
    } finally {
      s.dispose()
    }
  })
}
