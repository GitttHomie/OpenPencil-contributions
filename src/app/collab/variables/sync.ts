import { isEqual } from 'es-toolkit'
import type * as Y from 'yjs'

import { reconcileVariableLayouts } from '@open-pencil/core/layout/variables'

import type { EditorStore } from '@/app/editor/active-store'

import { changedVariableValues, type RegistrySnapshot } from './changes'
import { publishDefinitions, receiveDefinitions, snapshotDefinitions } from './maps'
import { collectionSchema, variableSchema } from './schema'

type Options = {
  store: EditorStore
  canPublish?: () => boolean
  doc: Y.Doc
  suppressGraphSync: (value: boolean) => void
  suppressYjsEvents: (value: boolean) => void
}

/** Room-owned variable registries; local document edits and peer updates share native IDs. */
export function createVariableSync({
  store,
  doc,
  suppressGraphSync,
  suppressYjsEvents,
  canPublish = () => true
}: Options) {
  const variables = doc.getMap<Y.Map<unknown>>('variables')
  const collections = doc.getMap<Y.Map<unknown>>('variableCollections')
  const activeModes = doc.getMap<string>('variableActiveModes')
  const knownVariables = new Set<string>()
  const knownCollections = new Set<string>()
  let busy = false
  let disposed = false
  let changed = false
  let previous = snapshot()

  function snapshot(before?: RegistrySnapshot): RegistrySnapshot {
    return {
      variables: snapshotDefinitions(store.graph.variables, before?.variables),
      collections: snapshotDefinitions(store.graph.variableCollections, before?.collections),
      activeModes:
        before && isEqual(store.graph.activeMode, before.activeModes)
          ? before.activeModes
          : new Map(store.graph.activeMode)
    }
  }

  function publish(all = false) {
    if (busy || disposed || !canPublish()) return
    const current = snapshot(previous)
    if (
      !all &&
      current.variables === previous.variables &&
      current.collections === previous.collections &&
      current.activeModes === previous.activeModes
    )
      return
    busy = true
    try {
      doc.transact(() => {
        publishDefinitions(
          collections,
          store.graph.variableCollections,
          all ? new Map() : previous.collections
        )
        publishDefinitions(variables, store.graph.variables, all ? new Map() : previous.variables)
        const beforeModes = all ? new Map<string, string>() : previous.activeModes
        for (const id of beforeModes.keys())
          if (!store.graph.activeMode.has(id)) activeModes.delete(id)
        for (const [id, mode] of store.graph.activeMode) {
          if (beforeModes.get(id) !== mode) activeModes.set(id, mode)
        }
      })
      for (const id of variables.keys()) knownVariables.add(id)
      for (const id of collections.keys()) knownCollections.add(id)
      previous = current
    } finally {
      busy = false
    }
  }

  function normalizeCollections() {
    const members = new Map<string, string[]>()
    for (const variable of store.graph.variables.values()) {
      const ids = members.get(variable.collectionId) ?? []
      ids.push(variable.id)
      members.set(variable.collectionId, ids)
    }
    for (const collection of store.graph.variableCollections.values()) {
      const ids = new Set(members.get(collection.id))
      const ordered = collection.variableIds.filter((id) => ids.delete(id))
      collection.variableIds = [...ordered, ...[...ids].sort()]
      const defaultMode = collection.modes.find((mode) => mode.modeId === collection.defaultModeId)
      if (!defaultMode) collection.defaultModeId = collection.modes[0].modeId
      const requested = activeModes.get(collection.id)
      const valid = collection.modes.some((mode) => mode.modeId === requested)
      store.graph.activeMode.set(
        collection.id,
        valid && requested ? requested : collection.defaultModeId
      )
    }
    for (const id of store.graph.activeMode.keys())
      if (!store.graph.variableCollections.has(id)) store.graph.activeMode.delete(id)
  }

  function receive(transaction: Y.Transaction) {
    if (transaction.local || !changed || busy || disposed) return
    changed = false
    busy = true
    suppressGraphSync(true)
    suppressYjsEvents(true)
    try {
      receiveDefinitions(
        collections,
        store.graph.variableCollections,
        knownCollections,
        collectionSchema
      )
      receiveDefinitions(variables, store.graph.variables, knownVariables, variableSchema)
      normalizeCollections()
      const current = snapshot(previous)
      const affected = changedVariableValues(previous, current)
      if (affected.size) {
        reconcileVariableLayouts(store.graph, { variables: affected })
        store.requestRender()
      } else store.requestRefresh()
      previous = current
    } finally {
      suppressYjsEvents(false)
      suppressGraphSync(false)
      busy = false
    }
  }

  function markChanged(_events: unknown, transaction: Y.Transaction) {
    if (!transaction.local) changed = true
  }
  variables.observeDeep(markChanged)
  collections.observeDeep(markChanged)
  activeModes.observe(markChanged)
  doc.on('afterTransaction', receive)
  // Editor commands, AI tools, imports and Undo may edit the registries directly.
  // Scene-change notifications catch all of them; viewport-only repaint events do not.
  const stop = store.onEditorEvent('render:requested', () => publish())
  const stopRefresh = store.onEditorEvent('refresh:requested', () => publish())
  return {
    publishChanges: () => publish(),
    publishAll: () => publish(true),
    dispose() {
      if (disposed) return
      disposed = true
      stop()
      stopRefresh()
      doc.off('afterTransaction', receive)
      variables.unobserveDeep(markChanged)
      collections.unobserveDeep(markChanged)
      activeModes.unobserve(markChanged)
    }
  }
}
