import { expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { componentScenario, documentStates } from './fixture'

for (const state of documentStates) {
  for (const forwarded of [false, true]) {
    test(`${state}: ${forwarded ? 'exposed' : 'direct'} nested variant changes size independently and survives undo and reopening`, async () => {
      const s = await componentScenario(state)
      try {
        const small = s.node('Badge')
        const largeId = expectDefined(s.editor.addVariant(small.id))
        s.editor.updateNodeWithUndo(largeId, { width: 48, height: 48 })
        const set = expectDefined(s.graph.getNode(small.parentId ?? ''))
        expect(set.layoutMode).not.toBe('NONE')
        const variant = expectDefined(
          set.componentPropertyDefinitions.find((p) => p.type === 'VARIANT')
        )
        const largeValue = expectDefined(s.graph.getNode(largeId)).componentPropertyValues[
          variant.name
        ]
        await s.mutate(() => {
          for (const name of ['Leading', 'Trailing'])
            s.graph.createInstance(small.id, s.node('Card').id, { name })
        })
        const source = s.node('Leading', s.node('Card'))
        s.editor.setNestedComponentPropertyExposure(s.node('Card').id, source.id, [variant.id])
        const exposed = expectDefined(
          s.editor.getInstanceComponentPropertyDefinitions(s.node('First').id)[0]
        )
        const change = () =>
          s.editor.setInstanceComponentProperty(
            forwarded ? s.node('First').id : s.node('Leading', s.node('First')).id,
            forwarded ? exposed.id : variant.id,
            largeValue
          )
        change()
        await s.settle()
        const expectSizes = (size: number) => {
          expect(s.node('Leading', s.node('First')).height).toBe(size)
          expect(s.node('Trailing', s.node('First')).height).toBe(24)
          expect(s.node('Leading', s.node('Second')).height).toBe(24)
          expect(s.node('First').height).toBe(84 + size)
          expect(s.node('Second').height).toBe(108)
        }
        expectSizes(48)
        s.editor.undo.undo()
        await s.settle()
        expectSizes(24)
        s.editor.undo.redo()
        await s.settle()
        expectSizes(48)
        s.editor.updateNodeWithUndo(s.node('Card').id, { cornerRadius: 8 })
        await s.settle()
        expectSizes(48)
        await s.reopen()
        s.assertLinked()
        expectSizes(48)
      } finally {
        s.dispose()
      }
    })
  }

  test(`${state}: imported whole-instance exposure works with selective controls and undo`, async () => {
    const s = await componentScenario(state)
    try {
      const property = expectDefined(
        s.editor.exposeComponentProperty(s.node('Count', s.node('Badge')).id, 'TEXT', 'Number')
      )
      await s.mutate(() => {
        s.graph.createInstance(s.node('Badge').id, s.node('Card').id, { name: 'Counter' })
      })
      expect(s.editor.setInstanceExposed(s.node('Counter', s.node('Card')).id, true)).toBe(true)
      await s.settle()
      const definition = expectDefined(
        s.editor.getInstanceComponentPropertyDefinitions(s.node('First').id)[0]
      )
      s.editor.setInstanceComponentProperty(s.node('First').id, definition.id, '9')
      await s.settle()
      expect(s.node('Count', s.node('Counter', s.node('First'))).text).toBe('9')
      expect(s.node('Count', s.node('Counter', s.node('Second'))).text).toBe('1')
      s.editor.setNestedComponentPropertyExposure(
        s.node('Card').id,
        s.node('Counter', s.node('Card')).id,
        []
      )
      expect(s.editor.getInstanceComponentPropertyDefinitions(s.node('First').id)).toEqual([])
      s.editor.undo.undo()
      await s.settle()
      expect(s.editor.getInstanceComponentPropertyDefinitions(s.node('First').id)[0]?.name).toBe(
        'Counter / Number'
      )
      await s.reopen()
      expect(s.editor.getInstanceComponentPropertyDefinitions(s.node('First').id)).toHaveLength(1)
      expect(s.node('Count', s.node('Counter', s.node('First'))).text).toBe('9')
      const candidate = expectDefined(
        s.editor.getNestedComponentPropertyCandidates(s.node('Card').id)[0]
      )
      expect(candidate.exposed).toHaveLength(1)
      expect(candidate.properties[0]?.type).toBe('TEXT')
      expect(property).toBeTruthy()
    } finally {
      s.dispose()
    }
  })

  test(`${state}: a nested component swap preserves other occurrences and reflows its container`, async () => {
    const s = await componentScenario(state)
    try {
      await s.mutate(() => {
        for (const name of ['Leading', 'Trailing'])
          s.graph.createInstance(s.node('Badge').id, s.node('Card').id, { name })
      })
      const property = expectDefined(
        s.editor.exposeComponentProperty(
          s.node('Leading', s.node('Card')).id,
          'INSTANCE_SWAP',
          'Leading icon'
        )
      )
      s.editor.setInstanceComponentProperty(s.node('First').id, property, s.node('Icon').id)
      await s.settle()
      const expectSwap = (height: number) => {
        expect(s.node('Leading', s.node('First')).height).toBe(height)
        expect(s.node('Trailing', s.node('First')).height).toBe(24)
        expect(s.node('Leading', s.node('Second')).height).toBe(24)
        expect(s.node('First').height).toBe(84 + height)
      }
      expectSwap(32)
      s.editor.undo.undo()
      await s.settle()
      expectSwap(24)
      s.editor.undo.redo()
      await s.settle()
      expectSwap(32)
      await s.reopen()
      s.assertLinked()
      expectSwap(32)
    } finally {
      s.dispose()
    }
  })

  test(`${state}: one hundred instances follow structural and visibility edits without duplicates`, async () => {
    const s = await componentScenario(state)
    try {
      await s.mutate(() => {
        for (let index = 2; index < 100; index++)
          s.graph.createInstance(s.node('Card').id, s.node('List').id, { name: `Copy ${index}` })
      })
      const ids = s.copies().map((n) => n.id)
      const property = expectDefined(
        s.editor.exposeComponentProperty(
          s.node('Subtext', s.node('Card')).id,
          'VISIBLE',
          'Show note'
        )
      )
      s.editor.setInstanceComponentProperty(s.node('First').id, property, 'true')
      await s.mutate(() => {
        s.graph.createInstance(s.node('Badge').id, s.node('Card').id, { name: 'Counter' })
      })
      s.editor.setComponentPropertyDefault(s.node('Card').id, property, 'false')
      await s.settle()
      s.assertLinked()
      expect(s.copies().map((n) => n.id)).toEqual(ids)
      expect(s.copies().map((n) => n.height)).toEqual([80, ...Array.from({ length: 99 }, () => 64)])
      await s.mutate(() => s.graph.deleteNode(s.node('Counter', s.node('Card')).id))
      s.assertLinked()
      expect(s.copies().map((n) => n.height)).toEqual([52, ...Array.from({ length: 99 }, () => 36)])
      s.editor.undo.undo()
      await s.settle()
      s.assertLinked()
      expect(s.copies().map((n) => n.height)).toEqual([80, ...Array.from({ length: 99 }, () => 64)])
      await s.reopen()
      s.assertLinked()
      expect(s.copies()).toHaveLength(100)
      expect(s.copies().map((n) => n.height)).toEqual([80, ...Array.from({ length: 99 }, () => 64)])
    } finally {
      s.dispose()
    }
  })
}
