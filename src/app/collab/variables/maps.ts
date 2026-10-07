import { isEqual } from 'es-toolkit'
import * as v from 'valibot'
import * as Y from 'yjs'

type Definition = { id: string }
export type DefinitionMap = Y.Map<Y.Map<unknown>>

/** Keep unchanged snapshots by reference; ordinary canvas edits allocate no variable copies. */
export function snapshotDefinitions<T extends Definition>(
  current: ReadonlyMap<string, T>,
  previous: ReadonlyMap<string, T> = new Map()
): ReadonlyMap<string, T> {
  let next: Map<string, T> | undefined
  for (const id of previous.keys()) {
    if (current.has(id)) continue
    next ??= new Map(previous)
    next.delete(id)
  }
  for (const [id, definition] of current) {
    if (isEqual(definition, previous.get(id))) continue
    next ??= new Map(previous)
    next.set(id, structuredClone(definition))
  }
  return next ?? previous
}

// A rename and a value edit, or edits in two different modes, merge independently.
const NESTED_FIELDS = new Set(['valuesByMode', 'expressions', 'codeSyntax'])

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : {}
}

function publishFields(
  target: Y.Map<unknown>,
  current: Record<string, unknown>,
  previous: Record<string, unknown>,
  nested: boolean
) {
  for (const key of new Set([...Object.keys(previous), ...Object.keys(current)])) {
    if (isEqual(current[key], previous[key])) continue
    if (current[key] === undefined) {
      target.delete(key)
    } else if (nested && NESTED_FIELDS.has(key)) {
      let child = target.get(key)
      if (!(child instanceof Y.Map)) {
        child = new Y.Map<unknown>()
        target.set(key, child)
      }
      if (child instanceof Y.Map)
        publishFields(child, record(current[key]), record(previous[key]), false)
    } else {
      target.set(key, structuredClone(current[key]))
    }
  }
}

export function publishDefinitions<T extends Definition>(
  target: DefinitionMap,
  current: ReadonlyMap<string, T>,
  previous: ReadonlyMap<string, T>
) {
  for (const id of previous.keys()) if (!current.has(id)) target.delete(id)
  for (const [id, definition] of current) {
    const before = previous.get(id)
    if (isEqual(definition, before)) continue
    let entry = target.get(id)
    if (!(entry instanceof Y.Map)) {
      entry = new Y.Map<unknown>()
      target.set(id, entry)
    }
    publishFields(entry, record(definition), record(before), true)
  }
}

/** Ignore malformed peer records, retaining the last valid local value until corrected. */
export function receiveDefinitions<T extends Definition>(
  source: DefinitionMap,
  target: Map<string, T>,
  known: Set<string>,
  schema: v.GenericSchema<unknown, T>
) {
  for (const id of known) {
    if (!source.has(id)) {
      target.delete(id)
      known.delete(id)
    }
  }
  for (const [id, entry] of source) {
    if (!(entry instanceof Y.Map)) continue
    const parsed = v.safeParse(schema, entry.toJSON())
    if (!parsed.success || parsed.output.id !== id) continue
    known.add(id)
    if (!isEqual(target.get(id), parsed.output)) target.set(id, structuredClone(parsed.output))
  }
}
