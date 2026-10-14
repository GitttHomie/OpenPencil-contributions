import { expect, test } from 'bun:test'

import { kinds, savedLayoutScenario, states } from './fixture'

for (const kind of kinds)
  for (const state of states) {
    test(`${kind}/${state}: gap edits reflow contents and Hug dimensions`, async () => {
      const s = await savedLayoutScenario(kind, state)
      try {
        for (const gap of [20, 0, 4]) {
          await s.edit(s.target().id, { itemSpacing: gap })
          s.assertFlow(gap)
        }
        s.editor.undo.undo()
        await s.settle()
        s.assertFlow(0)
        s.editor.undo.redo()
        await s.settle()
        s.assertFlow(4)
        await s.reopen()
        s.assertFlow(4)
      } finally {
        s.dispose()
      }
    })
    test(`${kind}/${state}: padding edits reflow both positions and sizes`, async () => {
      const s = await savedLayoutScenario(kind, state)
      try {
        for (const padding of [0, 12]) {
          await s.edit(s.target().id, {
            paddingLeft: padding,
            paddingRight: padding,
            paddingTop: padding,
            paddingBottom: padding
          })
          s.assertFlow(4, padding)
        }
        await s.reopen()
        s.assertFlow(4, 12)
      } finally {
        s.dispose()
      }
    })
    test(`${kind}/${state}: nested text grows and shrinks Hug ancestors`, async () => {
      const s = await savedLayoutScenario(kind, state)
      try {
        for (const [text, height] of [
          ['A'.repeat(80), 76],
          ['Title', 36]
        ] as const) {
          await s.edit(s.node('Title', s.node('Body')).id, { text })
          s.assertFlow(4, 8, height)
        }
      } finally {
        s.dispose()
      }
    })
    test(`${kind}/${state}: changing a fixed child resizes Hug ancestors`, async () => {
      const s = await savedLayoutScenario(kind, state)
      try {
        for (const height of [40, 16]) {
          await s.edit(s.node('Footer').id, { height })
          s.assertFlow(4, 8, 36, height)
        }
      } finally {
        s.dispose()
      }
    })
    test(`${kind}/${state}: visibility releases and restores layout space`, async () => {
      const s = await savedLayoutScenario(kind, state)
      try {
        await s.edit(s.node('Footer').id, { visible: false })
        for (const n of s.affected()) expect(n.height).toBe(52)
        await s.edit(s.node('Footer').id, { visible: true })
        s.assertFlow()
      } finally {
        s.dispose()
      }
    })
    test(`${kind}/${state}: alignment updates without resizing the container`, async () => {
      const s = await savedLayoutScenario(kind, state, true)
      try {
        await s.edit(s.target().id, { primaryAxisAlign: 'CENTER', counterAxisAlign: 'CENTER' })
        for (const n of s.affected()) {
          expect(s.node('Body', n).y).toBe(52)
          expect(s.node('Footer', n).y).toBe(92)
          expect(s.node('Footer', n).x).toBe(80)
        }
        await s.edit(s.target().id, { primaryAxisAlign: 'MAX', counterAxisAlign: 'MAX' })
        for (const n of s.affected()) {
          expect(s.node('Body', n).y).toBe(96)
          expect(s.node('Footer', n).y).toBe(136)
          expect(s.node('Footer', n).x).toBe(152)
        }
      } finally {
        s.dispose()
      }
    })
    test(`${kind}/${state}: padding preview updates immediately and cancels exactly`, async () => {
      const s = await savedLayoutScenario(kind, state)
      try {
        const preview = s.editor.beginNodePreview('Padding')
        preview.update(s.target().id, {
          paddingTop: 0,
          paddingBottom: 0,
          paddingLeft: 0,
          paddingRight: 0
        })
        // Preview changes remain local until committed; the definition/instance under edit must reflow.
        const body = s.node('Body')
        expect(body.x).toBe(0)
        expect(body.y).toBe(0)
        expect(s.target().height).toBe(56)
        preview.cancel()
        s.assertFlow()
        expect(s.editor.undo.canUndo).toBe(false)
      } finally {
        s.dispose()
      }
    })
  }
