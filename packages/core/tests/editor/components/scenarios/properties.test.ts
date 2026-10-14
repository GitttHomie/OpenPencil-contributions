import { expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { componentScenario, documentStates } from './fixture'

for (const state of documentStates) {
  test(`${state}: clipping overrides survive reopening and later component edits`, async () => {
    const s = await componentScenario(state)
    try {
      s.editor.updateNodeWithUndo(s.node('Card').id, { clipsContent: true })
      await s.settle()
      s.editor.updateNodeWithUndo(s.node('First').id, { clipsContent: false })
      await s.reopen()
      expect(s.copies().map((n) => n.clipsContent)).toEqual([false, true])
      s.editor.updateNodeWithUndo(s.node('Card').id, { cornerRadius: 8 })
      await s.settle()
      expect(s.copies().map((n) => n.clipsContent)).toEqual([false, true])
      s.editor.updateNodeWithUndo(s.node('Card').id, { clipsContent: false })
      await s.settle()
      s.editor.updateNodeWithUndo(s.node('Second').id, { clipsContent: true })
      await s.reopen()
      expect(s.copies().map((n) => n.clipsContent)).toEqual([false, true])
    } finally {
      s.dispose()
    }
  })

  test(`${state}: default visibility reflows instances while explicit visibility stays local`, async () => {
    const s = await componentScenario(state)
    try {
      const property = expectDefined(
        s.editor.exposeComponentProperty(
          s.node('Subtext', s.node('Card')).id,
          'VISIBLE',
          'Show note'
        )
      )
      s.editor.setInstanceComponentProperty(s.node('Second').id, property, 'true')
      s.editor.setComponentPropertyDefault(s.node('Card').id, property, 'false')
      await s.settle()
      expect(s.copies().map((n) => n.height)).toEqual([36, 52])
      expect(s.node('List').height).toBe(98)
      s.editor.undo.undo()
      await s.settle()
      expect(s.copies().map((n) => n.height)).toEqual([52, 52])
      s.editor.undo.redo()
      await s.settle()
      expect(s.copies().map((n) => n.height)).toEqual([36, 52])
      await s.reopen()
      s.assertLinked()
      expect(s.copies().map((n) => n.height)).toEqual([36, 52])
    } finally {
      s.dispose()
    }
  })

  test(`${state}: longer and shorter text defaults wrap and resize without replacing an override`, async () => {
    const s = await componentScenario(state)
    try {
      const property = expectDefined(
        s.editor.exposeComponentProperty(s.node('Title', s.node('Card')).id, 'TEXT', 'Label')
      )
      s.editor.setInstanceComponentProperty(s.node('Second').id, property, 'Custom')
      s.editor.setComponentPropertyDefault(s.node('Card').id, property, 'A'.repeat(80))
      await s.settle()
      expect(s.node('Title', s.node('First')).text).toHaveLength(80)
      expect(s.node('Title', s.node('Second')).text).toBe('Custom')
      expect(s.copies().map((n) => n.height)).toEqual([92, 52])
      s.editor.setComponentPropertyDefault(s.node('Card').id, property, 'Hi')
      await s.settle()
      expect(s.copies().map((n) => n.height)).toEqual([52, 52])
      s.editor.undo.undo()
      await s.settle()
      expect(s.copies().map((n) => n.height)).toEqual([92, 52])
      s.editor.undo.redo()
      await s.settle()
      await s.reopen()
      expect(s.node('Title', s.node('First')).text).toBe('Hi')
      expect(s.node('Title', s.node('Second')).text).toBe('Custom')
    } finally {
      s.dispose()
    }
  })

  test(`${state}: linking a second layer inherits an existing assignment and undoes both targets`, async () => {
    const s = await componentScenario(state)
    try {
      const property = expectDefined(
        s.editor.exposeComponentProperty(s.node('Title', s.node('Card')).id, 'TEXT', 'Label')
      )
      s.editor.setInstanceComponentProperty(s.node('First').id, property, 'Assigned')
      s.editor.bindComponentProperty(s.node('Subtext', s.node('Card')).id, 'TEXT', property)
      await s.settle()
      expect(s.graph.getChildren(s.node('First').id).map((n) => n.text)).toEqual([
        'Assigned',
        'Assigned'
      ])
      s.editor.setInstanceComponentProperty(s.node('First').id, property, 'Replacement')
      s.editor.undo.undo()
      await s.settle()
      expect(s.graph.getChildren(s.node('First').id).map((n) => n.text)).toEqual([
        'Assigned',
        'Assigned'
      ])
      s.editor.undo.redo()
      await s.settle()
      expect(s.graph.getChildren(s.node('First').id).map((n) => n.text)).toEqual([
        'Replacement',
        'Replacement'
      ])
      await s.reopen()
      expect(s.graph.getChildren(s.node('First').id).map((n) => n.text)).toEqual([
        'Replacement',
        'Replacement'
      ])
      expect(s.graph.getChildren(s.node('Second').id).map((n) => n.text)).toEqual([
        'Title',
        'Title'
      ])
    } finally {
      s.dispose()
    }
  })

  test(`${state}: rename, unlink and delete property definitions preserve their layers`, async () => {
    const s = await componentScenario(state)
    try {
      const property = expectDefined(
        s.editor.exposeComponentProperty(s.node('Title', s.node('Card')).id, 'TEXT', 'Label')
      )
      s.editor.setInstanceComponentProperty(s.node('First').id, property, 'Assigned')
      s.editor.renameComponentProperty(s.node('Card').id, property, 'Caption')
      expect(s.editor.getInstanceComponentPropertyDefinitions(s.node('First').id)[0]?.id).toBe(
        property
      )
      expect(s.editor.getInstanceComponentPropertyDefinitions(s.node('First').id)[0]?.name).toBe(
        'Caption'
      )
      s.editor.bindComponentProperty(s.node('Title', s.node('Card')).id, 'TEXT', null)
      await s.settle()
      s.assertLinked()
      expect(s.node('Title', s.node('Card')).componentPropertyReferences).toEqual([])
      s.editor.undo.undo()
      await s.settle()
      expect(s.node('Title', s.node('First')).text).toBe('Assigned')
      s.editor.deleteComponentProperty(s.node('Card').id, property)
      await s.settle()
      s.assertLinked()
      expect(s.editor.getInstanceComponentPropertyDefinitions(s.node('First').id)).toEqual([])
      s.editor.undo.undo()
      await s.settle()
      expect(s.editor.getInstanceComponentPropertyDefinitions(s.node('First').id)[0]?.name).toBe(
        'Caption'
      )
      await s.reopen()
      s.assertLinked()
    } finally {
      s.dispose()
    }
  })

  test(`${state}: style and typography edits inherit without leaking an instance override`, async () => {
    const s = await componentScenario(state)
    try {
      s.editor.updateNodeWithUndo(s.node('First').id, { cornerRadius: 12 })
      s.editor.updateNodeWithUndo(s.node('Card').id, { cornerRadius: 4, cornerSmoothing: 0.6 })
      s.editor.updateNodeWithUndo(s.node('Title', s.node('Card')).id, {
        fontWeight: 700,
        fontFamily: 'Inter'
      })
      await s.settle()
      expect(s.copies().map((n) => n.cornerRadius)).toEqual([12, 4])
      expect(s.copies().map((n) => n.cornerSmoothing)).toEqual([0.6, 0.6])
      for (const n of s.copies()) {
        expect(s.node('Title', n).fontWeight).toBe(700)
        expect(s.node('Title', n).textAutoResize).toBe('HEIGHT')
      }
      await s.reopen()
      expect(s.copies().map((n) => n.cornerRadius)).toEqual([12, 4])
      s.editor.updateNodeWithUndo(s.node('Second').id, {
        fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
      })
      await s.settle()
      expect(s.node('Card').fills).not.toEqual(s.node('Second').fills)
      expect(s.node('First').fills).toEqual(s.node('Card').fills)
    } finally {
      s.dispose()
    }
  })

  test(`${state}: nested visibility removes occupied space and restores the same instance`, async () => {
    const s = await componentScenario(state)
    try {
      await s.mutate(() => {
        s.graph.createInstance(s.node('Badge').id, s.node('Card').id, { name: 'Counter' })
      })
      const property = expectDefined(
        s.editor.exposeComponentProperty(
          s.node('Counter', s.node('Card')).id,
          'VISIBLE',
          'Show counter'
        )
      )
      const ids = s.copies().map((n) => s.node('Counter', n).id)
      s.editor.setComponentPropertyDefault(s.node('Card').id, property, 'false')
      await s.settle()
      expect(s.copies().map((n) => n.height)).toEqual([52, 52])
      s.editor.setComponentPropertyDefault(s.node('Card').id, property, 'true')
      await s.settle()
      expect(s.copies().map((n) => s.node('Counter', n).id)).toEqual(ids)
      expect(s.copies().map((n) => n.height)).toEqual([80, 80])
      await s.reopen()
      s.assertLinked()
      expect(s.copies().map((n) => n.height)).toEqual([80, 80])
    } finally {
      s.dispose()
    }
  })
  test(`${state}: zero and independent corner overrides survive later component edits and two saves`, async () => {
    const s = await componentScenario(state)
    try {
      s.editor.updateNodeWithUndo(s.node('First').id, { cornerRadius: 0, cornerSmoothing: 0 })
      s.editor.updateNodeWithUndo(s.node('Second').id, {
        independentCorners: true,
        topLeftRadius: 2,
        topRightRadius: 4,
        bottomRightRadius: 6,
        bottomLeftRadius: 8,
        cornerSmoothing: 0.8
      })
      const check = () => {
        expect(s.node('First')).toMatchObject({ cornerRadius: 0, cornerSmoothing: 0 })
        expect(s.node('Second')).toMatchObject({
          independentCorners: true,
          topLeftRadius: 2,
          topRightRadius: 4,
          bottomRightRadius: 6,
          bottomLeftRadius: 8
        })
        expect(s.node('Second').cornerSmoothing).toBeCloseTo(0.8, 6)
      }
      for (const radius of [12, 16]) {
        s.editor.updateNodeWithUndo(s.node('Card').id, {
          cornerRadius: radius,
          cornerSmoothing: 0.6
        })
        await s.settle()
        check()
        await s.reopen()
        check()
      }
    } finally {
      s.dispose()
    }
  })
}
