import { mapKeys } from 'es-toolkit/object'
import { isEmptyObject } from 'es-toolkit/predicate'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import {
  OPEN_PENCIL_PLUGIN_DATA,
  pluginDataEntry,
  withoutPluginData,
  type PluginDataEntry,
  type Variable,
  type VariableCollection,
  type VariableValue
} from '@open-pencil/scene-graph'

import { getOpenPencilPluginValue, OPEN_PENCIL_PLUGIN_ID } from '../plugin-data'

const { token, modeConditions, modeAttribute } = OPEN_PENCIL_PLUGIN_DATA
export const TOKEN_PLUGIN_KEY = token.key
export const MODE_CONDITIONS_PLUGIN_KEY = modeConditions.key

type TokenFields = Pick<Variable, 'unit' | 'expressions'>

/** Plugin data other than the entries this module owns, which are rebuilt on every save. */
export function withoutTokenPluginData(pluginData: PluginDataEntry[]): PluginDataEntry[] {
  return withoutPluginData(pluginData, [token, modeConditions, modeAttribute])
}

function nonEmpty<T extends object>(record: T): T | undefined {
  return isEmptyObject(record) ? undefined : record
}

function sameNumber(a: VariableValue | undefined, b: number): boolean {
  return typeof a === 'number' && Math.abs(a - b) < 1e-6
}

/**
 * The stored number stays authoritative: an expression whose mode value was edited elsewhere,
 * Figma included, no longer describes that value and is dropped rather than overriding it.
 */
export function readVariableToken(
  nc: NodeChange,
  valuesByMode: Record<string, VariableValue>
): TokenFields {
  const token =
    OPEN_PENCIL_PLUGIN_DATA.token.decode(
      getOpenPencilPluginValue(nc, OPEN_PENCIL_PLUGIN_DATA.token.key)
    ) ?? {}
  const expressions = Object.entries(token.expressions ?? {}).filter(([mode, expression]) =>
    sameNumber(valuesByMode[mode], expression.resolved)
  )
  return { unit: token.unit, expressions: nonEmpty(Object.fromEntries(expressions)) }
}

export function readModeConditions(nc: NodeChange): Record<string, string> {
  return (
    OPEN_PENCIL_PLUGIN_DATA.modeConditions.decode(
      getOpenPencilPluginValue(nc, modeConditions.key)
    ) ?? {}
  )
}

function entry(key: string, value: object): PluginDataEntry {
  return { pluginId: OPEN_PENCIL_PLUGIN_ID, key, value: JSON.stringify(value) }
}

export function readModeAttribute(nc: NodeChange): string | undefined {
  return modeAttribute.decode(getOpenPencilPluginValue(nc, modeAttribute.key))
}

export function modeAttributePluginData(
  collection: VariableCollection
): PluginDataEntry | undefined {
  return collection.modeAttribute
    ? pluginDataEntry(modeAttribute, collection.modeAttribute)
    : undefined
}

/** Mode ids in the file differ from the model's, so callers map them. */
export function tokenPluginData(
  variable: Variable,
  modeKey: (modeId: string) => string
): PluginDataEntry | undefined {
  const token = {
    unit: variable.unit,
    expressions: nonEmpty(mapKeys(variable.expressions ?? {}, (_, mode) => modeKey(mode)))
  }
  if (!token.unit && !token.expressions) return undefined
  return entry(OPEN_PENCIL_PLUGIN_DATA.token.key, token)
}

export function modeConditionsPluginData(
  collection: VariableCollection,
  modeKey: (modeId: string) => string
): PluginDataEntry | undefined {
  const conditions = collection.modes.flatMap((mode) =>
    mode.condition ? [[modeKey(mode.modeId), mode.condition] as const] : []
  )
  return conditions.length > 0
    ? entry(modeConditions.key, Object.fromEntries(conditions))
    : undefined
}
