import { expect, test } from 'bun:test'

import * as Y from 'yjs'

import type { Variable } from '@open-pencil/scene-graph'

import { createVariableSync } from '@/app/collab/variables/sync'
import { createEditorStore } from '@/app/editor/session'

import { connectYDocs } from '#tests/helpers/yjs'

function peer() {
  const store = createEditorStore()
  const doc = new Y.Doc()
  const suppression = { graph: false, yjs: false }
  const sync = createVariableSync({
    store,
    doc,
    suppressGraphSync: (value) => {
      suppression.graph = value
    },
    suppressYjsEvents: (value) => {
      suppression.yjs = value
    }
  })
  return {
    store,
    doc,
    sync,
    suppression,
    close() {
      sync.dispose()
      store.dispose()
      doc.destroy()
    }
  }
}

function foundations(host: ReturnType<typeof peer>) {
  const graph = host.store.graph
  const collection = graph.createCollection('Foundations')
  graph.addMode(collection.id, 'dark', 'Dark')
  const color = graph.createVariable('Brand', 'COLOR', collection.id, { r: 1, g: 0, b: 0, a: 1 })
  color.valuesByMode.dark = { r: 0, g: 0, b: 1, a: 1 }
  const alias = graph.createVariable('Action', 'COLOR', collection.id, { aliasId: color.id })
  const space = graph.createVariable('Padding', 'FLOAT', collection.id, 8)
  space.valuesByMode.dark = 16
  space.unit = 'px'
  space.scopes = ['GAP']
  space.codeSyntax = { WEB: '--space-control' }
  graph.createVariable('Caption', 'STRING', collection.id, 'Continue')
  graph.createVariable('Visible', 'BOOLEAN', collection.id, true)
  return { collection, color, alias, space }
}

test('renames and reorders reach peers without invalidating either canvas', () => {
  const host = peer()
  const guest = peer()
  try {
    const { collection, space } = foundations(host)
    host.sync.publishAll()
    const disconnect = connectYDocs(host.doc, guest.doc)
    try {
      const hostVersion = host.store.state.canvasVersion
      const guestVersion = guest.store.state.canvasVersion
      host.store.renameVariable(space.id, 'Control spacing')
      expect(guest.store.graph.variables.get(space.id)?.name).toBe('Control spacing')
      const order = [...collection.variableIds].reverse()
      host.store.setVariableOrder(collection.id, order)
      expect(guest.store.graph.variableCollections.get(collection.id)?.variableIds).toEqual(order)
      host.store.undo.undo()
      host.store.undo.undo()
      expect(guest.store.graph.variables.get(space.id)?.name).toBe('Padding')
      expect(host.store.state.canvasVersion).toBe(hostVersion)
      expect(guest.store.state.canvasVersion).toBe(guestVersion)
    } finally {
      disconnect()
    }
  } finally {
    host.close()
    guest.close()
  }
})

test('peer value changes leave unrelated bound layers at their saved dimensions', () => {
  const host = peer()
  const guest = peer()
  try {
    const { collection, space } = foundations(host)
    const other = host.store.graph.createVariable('Other', 'FLOAT', collection.id, 120)
    host.sync.publishAll()
    const disconnect = connectYDocs(host.doc, guest.doc)
    try {
      const graph = guest.store.graph
      const bound = graph.createNode('FRAME', guest.store.state.currentPageId, {
        width: 8,
        boundVariables: { width: space.id }
      })
      const unrelated = graph.createNode('FRAME', guest.store.state.currentPageId, {
        width: 90,
        boundVariables: { width: other.id }
      })
      host.store.updateVariableValue(space.id, collection.defaultModeId, 24)
      expect(bound.width).toBe(24)
      expect(unrelated.width).toBe(90)
    } finally {
      disconnect()
    }
  } finally {
    host.close()
    guest.close()
  }
})

test('token editor metadata and mode conditions synchronize with undo and clearing', () => {
  const host = peer()
  const guest = peer()
  try {
    const { collection, space } = foundations(host)
    host.sync.publishAll()
    const disconnect = connectYDocs(host.doc, guest.doc)
    try {
      const modeId = collection.defaultModeId
      host.store.updateVariableToken(space.id, {
        unit: 'rem',
        expressions: { [modeId]: { css: 'clamp(.5rem, 2vw, 1rem)', resolved: 8 } }
      })
      host.store.setModeAttribute(collection.id, 'data-scheme')
      expect(guest.store.graph.variableCollections.get(collection.id)?.modeAttribute).toBe(
        'data-scheme'
      )
      host.store.undo.undo()
      expect(
        guest.store.graph.variableCollections.get(collection.id)?.modeAttribute
      ).toBeUndefined()
      host.store.setModeCondition(collection.id, 'dark', '@media (prefers-color-scheme: dark)')
      expect(guest.store.graph.variables.get(space.id)).toMatchObject({
        unit: 'rem',
        expressions: { [modeId]: { css: 'clamp(.5rem, 2vw, 1rem)', resolved: 8 } }
      })
      expect(guest.store.graph.variableCollections.get(collection.id)?.modes[1].condition).toBe(
        '@media (prefers-color-scheme: dark)'
      )
      host.store.undo.undo()
      expect(
        guest.store.graph.variableCollections.get(collection.id)?.modes[1].condition
      ).toBeUndefined()
      host.store.updateVariableToken(space.id, { expressions: undefined })
      expect(guest.store.graph.variables.get(space.id)?.expressions).toBeUndefined()
      host.store.undo.undo()
      expect(guest.store.graph.variables.get(space.id)?.expressions?.[modeId]?.css).toBe(
        'clamp(.5rem, 2vw, 1rem)'
      )
    } finally {
      disconnect()
    }
  } finally {
    host.close()
    guest.close()
  }
})

test('initial room state includes typed variables, aliases, modes and metadata', () => {
  const host = peer()
  const guest = peer()
  try {
    const { collection, alias, space } = foundations(host)
    host.store.graph.setActiveMode(collection.id, 'dark')
    host.sync.publishAll()
    const disconnect = connectYDocs(host.doc, guest.doc)
    try {
      expect(guest.store.graph.variables).toEqual(host.store.graph.variables)
      expect(guest.store.graph.variableCollections).toEqual(host.store.graph.variableCollections)
      expect(guest.store.graph.activeMode.get(collection.id)).toBe('dark')
      expect(guest.suppression).toEqual({ graph: false, yjs: false })
      expect(guest.store.graph.resolveColorVariable(alias.id)).toEqual({ r: 0, g: 0, b: 1, a: 1 })
      expect(guest.store.graph.resolveNumberVariable(space.id)).toBe(16)
    } finally {
      disconnect()
    }
  } finally {
    host.close()
    guest.close()
  }
})

test('local edits update peers, bound layout and undo without echoing unchanged definitions', () => {
  const host = peer()
  const guest = peer()
  try {
    const { collection, space } = foundations(host)
    host.sync.publishAll()
    const disconnect = connectYDocs(host.doc, guest.doc)
    try {
      const frame = guest.store.graph.createNode('FRAME', guest.store.state.currentPageId, {
        width: 100,
        height: 40,
        layoutMode: 'HORIZONTAL',
        boundVariables: { paddingLeft: space.id }
      })
      host.store.updateVariableValue(space.id, collection.defaultModeId, 24)
      expect(guest.store.graph.getNode(frame.id)?.paddingLeft).toBe(24)
      guest.store.renameVariable(space.id, 'Space/control')
      expect(host.store.graph.variables.get(space.id)?.name).toBe('Space/control')
      guest.store.undo.undo()
      expect(host.store.graph.variables.get(space.id)?.name).toBe('Padding')
      host.store.undo.undo()
      expect(guest.store.graph.getNode(frame.id)?.paddingLeft).toBe(8)
      host.store.setActiveMode(collection.id, 'dark')
      expect(guest.store.graph.getNode(frame.id)?.paddingLeft).toBe(16)
      const mode = host.store.addMode(collection.id, 'Compact')
      expect(guest.store.graph.variableCollections.get(collection.id)?.modes.at(-1)?.modeId).toBe(
        mode
      )
      let updates = 0
      const count = () => {
        updates++
      }
      host.doc.on('update', count)
      host.store.requestRender()
      host.store.requestRepaint()
      expect(updates).toBe(0)
      host.doc.off('update', count)
    } finally {
      disconnect()
    }
  } finally {
    host.close()
    guest.close()
  }
})

test('disconnected peers merge renames and values in different modes independently', () => {
  const host = peer()
  const guest = peer()
  try {
    const { collection, space } = foundations(host)
    host.sync.publishAll()
    connectYDocs(host.doc, guest.doc)()
    host.store.renameVariable(space.id, 'Space/medium')
    host.store.updateVariableValue(space.id, collection.defaultModeId, 20)
    guest.store.updateVariableValue(space.id, 'dark', 32)
    const disconnect = connectYDocs(host.doc, guest.doc)
    try {
      const expected = {
        name: 'Space/medium',
        valuesByMode: { [collection.defaultModeId]: 20, dark: 32 }
      }
      expect(host.store.graph.variables.get(space.id)).toMatchObject(expected)
      expect(guest.store.graph.variables.get(space.id)).toMatchObject(expected)
    } finally {
      disconnect()
    }
  } finally {
    host.close()
    guest.close()
  }
})

test('concurrent additions retain collection membership and deleted variables stay deleted after reconnect', () => {
  const host = peer()
  const guest = peer()
  try {
    const { collection, color, space } = foundations(host)
    host.sync.publishAll()
    connectYDocs(host.doc, guest.doc)()
    const first = host.store.graph.createVariable('First', 'FLOAT', collection.id, 1)
    host.store.requestRender()
    const second = guest.store.graph.createVariable('Second', 'FLOAT', collection.id, 2)
    guest.store.requestRender()
    host.store.removeVariable(color.id)
    guest.store.renameVariable(space.id, 'Spacing')
    const disconnect = connectYDocs(host.doc, guest.doc)
    try {
      for (const client of [host, guest]) {
        expect(client.store.graph.variableCollections.get(collection.id)?.variableIds).toEqual(
          expect.arrayContaining([first.id, second.id, space.id])
        )
        expect(client.store.graph.variables.has(color.id)).toBe(false)
      }
      expect(host.store.graph.variableCollections).toEqual(guest.store.graph.variableCollections)
      guest.store.removeCollection(collection.id)
      expect(host.store.graph.variableCollections.has(collection.id)).toBe(false)
      expect(host.store.graph.variables.size).toBe(0)
      guest.store.undo.undo()
      expect(host.store.graph.variables).toEqual(guest.store.graph.variables)
    } finally {
      disconnect()
    }
  } finally {
    host.close()
    guest.close()
  }
})

test('stored room updates restore registries and malformed peer definitions are ignored', () => {
  const host = peer()
  const restored = peer()
  try {
    const { collection, space } = foundations(host)
    host.sync.publishAll()
    Y.applyUpdate(restored.doc, Y.encodeStateAsUpdate(host.doc))
    expect(restored.store.graph.variables).toEqual(host.store.graph.variables)
    const disconnect = connectYDocs(host.doc, restored.doc)
    try {
      const variables = host.doc.getMap<Y.Map<unknown>>('variables')
      const entry = variables.get(space.id)
      if (!entry) throw new Error('Missing variable')
      entry.set('valuesByMode', { [collection.defaultModeId]: { unexpected: true } })
      expect(
        restored.store.graph.variables.get(space.id)?.valuesByMode[collection.defaultModeId]
      ).toBe(8)
      variables.set('invalid', new Y.Map([['name', 'Incomplete']]))
      expect(restored.store.graph.variables.has('invalid')).toBe(false)
    } finally {
      disconnect()
    }
  } finally {
    host.close()
    restored.close()
  }
})

test('disconnect disposes registry listeners and direct tool edits publish on scene changes', () => {
  const host = peer()
  const guest = peer()
  try {
    const { collection, space } = foundations(host)
    host.sync.publishAll()
    const disconnect = connectYDocs(host.doc, guest.doc)
    try {
      const updated: Variable = { ...space, description: 'Changed by a tool' }
      host.store.graph.variables.set(space.id, updated)
      host.store.requestRender()
      expect(guest.store.graph.variables.get(space.id)?.description).toBe('Changed by a tool')
      host.sync.dispose()
      host.store.updateVariableValue(space.id, collection.defaultModeId, 99)
      expect(guest.store.graph.resolveNumberVariable(space.id)).toBe(8)
    } finally {
      disconnect()
    }
  } finally {
    host.close()
    guest.close()
  }
})
