import { expect, test } from 'bun:test'

import { kinds, savedLayoutScenario } from './fixture'

for (const kind of kinds) {
  test(`${kind}: repeated resizing rewraps nested text and survives saving at the narrow size`, async () => {
    const s = await savedLayoutScenario(kind, 'retained')
    try {
      await s.edit(s.node('Title', s.node('Body')).id, { text: 'A'.repeat(80) })
      s.retainGeometry()
      for (const [width, height] of [
        [500, 56],
        [200, 96],
        [400, 56],
        [200, 96]
      ] as const) {
        await s.edit(s.target().id, { width })
        s.assertFlow(4, 8, height)
      }
      await s.reopen()
      s.assertFlow(4, 8, 96)
    } finally {
      s.dispose()
    }
  })
  if (kind !== 'instance')
    test(`${kind}: reordering saved fixed siblings persists their new positions`, async () => {
      const s = await savedLayoutScenario(kind, 'retained')
      try {
        await s.editor.runMutationWithLayout(() =>
          s.graph.reorderChild(s.node('Footer').id, s.target().id, 0)
        )
        await s.settle()
        for (const n of s.affected()) {
          expect(s.node('Footer', n).y).toBe(8)
          expect(s.node('Body', n).y).toBe(28)
        }
        await s.reopen()
        for (const n of s.affected()) {
          expect(s.node('Footer', n).y).toBe(8)
          expect(s.node('Body', n).y).toBe(28)
        }
      } finally {
        s.dispose()
      }
    })
  test(`${kind}: horizontal gaps, padding and cross-axis alignment reflow saved rows`, async () => {
    const s = await savedLayoutScenario(kind, 'fresh')
    try {
      await s.edit(s.target().id, { layoutMode: 'HORIZONTAL', height: 80 })
      await s.edit(s.node('Body').id, {
        layoutMode: 'NONE',
        width: 40,
        height: 20,
        layoutAlignSelf: 'AUTO'
      })
      await s.edit(s.node('Footer').id, { width: 60, height: 20 })
      s.retainGeometry()
      await s.edit(s.target().id, { itemSpacing: 20, counterAxisAlign: 'CENTER' })
      for (const n of s.affected()) {
        expect(n.width).toBe(136)
        expect(s.node('Body', n).x).toBe(8)
        expect(s.node('Footer', n).x).toBe(68)
        expect(s.node('Body', n).y).toBe(30)
      }
      await s.edit(s.target().id, { paddingLeft: 0, paddingRight: 0, itemSpacing: 0 })
      for (const n of s.affected()) {
        expect(n.width).toBe(100)
        expect(s.node('Footer', n).x).toBe(40)
      }
    } finally {
      s.dispose()
    }
  })
}

test('definition reflow preserves instance visibility and sizing overrides', async () => {
  const s = await savedLayoutScenario('component', 'retained')
  try {
    const copy = s.affected()[1]
    if (!copy) throw new Error('Instance missing')
    await s.edit(s.node('Footer', copy).id, { visible: false })
    await s.edit(copy.id, { width: 320 })
    s.retainGeometry()
    await s.edit(s.target().id, { itemSpacing: 20, paddingLeft: 12, paddingRight: 12 })
    expect(s.target().height).toBe(88)
    expect(copy.width).toBe(320)
    expect(copy.height).toBe(52)
    expect(s.node('Footer', copy).visible).toBe(false)
    expect(s.node('Body', copy).width).toBe(296)
  } finally {
    s.dispose()
  }
})
