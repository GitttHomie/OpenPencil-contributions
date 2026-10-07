import { isEqual } from 'es-toolkit'

import type { Variable, VariableCollection } from '@open-pencil/scene-graph'

export type RegistrySnapshot = {
  variables: ReadonlyMap<string, Variable>
  collections: ReadonlyMap<string, VariableCollection>
  activeModes: ReadonlyMap<string, string>
}

function collectionResolution(snapshot: RegistrySnapshot, id: string) {
  const collection = snapshot.collections.get(id)
  return {
    active: snapshot.activeModes.get(id),
    fallback: collection?.defaultModeId,
    modes: collection?.modes.map((mode) => mode.modeId)
  }
}

/** Values and mode resolution affect the canvas; names, order and token metadata do not. */
export function changedVariableValues(
  before: RegistrySnapshot,
  after: RegistrySnapshot
): Set<string> {
  const affected = new Set<string>()
  for (const id of new Set([...before.variables.keys(), ...after.variables.keys()])) {
    const old = before.variables.get(id)
    const next = after.variables.get(id)
    if (
      old?.type !== next?.type ||
      old?.collectionId !== next?.collectionId ||
      !isEqual(old?.valuesByMode, next?.valuesByMode)
    )
      affected.add(id)
  }
  for (const id of new Set([...before.collections.keys(), ...after.collections.keys()])) {
    if (isEqual(collectionResolution(before, id), collectionResolution(after, id))) continue
    for (const variable of [...before.variables.values(), ...after.variables.values()]) {
      if (variable.collectionId === id) affected.add(variable.id)
    }
  }
  return affected
}
