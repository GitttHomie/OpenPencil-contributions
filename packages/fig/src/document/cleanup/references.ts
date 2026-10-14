import {
  findStaticSegment,
  idOf,
  recordMatches,
  type SourceIndex
} from '#fig/instance-overrides/source-index'
import {
  assignedSlotContent,
  symbolDataOf,
  type ComponentPropAssignment,
  type ComponentPropRef,
  type SymbolOverride
} from '#fig/instance-overrides/types'

import type { GUID, NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'

type SwapDefinition = {
  id?: GUID
  parentPropDefId?: GUID
  type?: string
  initialValue?: ComponentPropAssignment['value']
  varValue?: ComponentPropAssignment['varValue']
  preferredValues?: { instanceSwapValues?: Array<{ key?: string; version?: string }> }
}

export function assignedComponent(value: ComponentPropAssignment): GUID | undefined {
  return value.value?.guidValue ?? value.varValue?.value?.symbolIdValue?.guid
}

export function swapDefinitions(record: NodeChange): SwapDefinition[] {
  return (record.componentPropDefs as SwapDefinition[] | undefined) ?? []
}

/** Property bindings in this component's scope, without entering nested component definitions. */
export function swapTargets(
  index: SourceIndex,
  componentId: string,
  propertyId: GUID
): NodeChange[] {
  const result: NodeChange[] = []
  const pending = [...(index.children.get(componentId) ?? [])]
  const seen = new Set<string>()
  while (pending.length) {
    const node = pending.pop()
    const id = node && idOf(node)
    if (!node || !id || seen.has(id)) continue
    seen.add(id)
    const refs = (node.componentPropRefs as ComponentPropRef[] | undefined) ?? []
    if (
      refs.some(
        (ref) =>
          ref.componentPropNodeField === 'OVERRIDDEN_SYMBOL_ID' &&
          ref.defID &&
          guidToString(ref.defID) === guidToString(propertyId)
      )
    )
      result.push(node)
    if (node.type !== 'INSTANCE') pending.push(...(index.children.get(id) ?? []))
  }
  return result
}

interface CleanupReferences {
  index: SourceIndex
  removed: ReadonlySet<string>
  removedProperties: ReadonlySet<string>
  unavailable: (guid: GUID | undefined) => boolean
  resolvePreferred: (key: string, version?: string) => string | undefined
}

function overrideComponent(
  index: SourceIndex,
  componentId: string | undefined,
  path: readonly GUID[]
) {
  let current = componentId && index.sources.get(componentId)
  for (const [position, segment] of path.entries()) {
    if (!current) return undefined
    if (position === 0 && recordMatches(current, segment)) continue
    const target = findStaticSegment(index, idOf(current) ?? '', segment).record
    const symbol = target?.symbolData?.symbolID
    if (!symbol) return undefined
    current = index.sources.get(guidToString(symbol))
  }
  return current && idOf(current)
}

function cleanProperties(source: NodeChange, context: CleanupReferences): NodeChange {
  let result = source
  const replace = (changes: Partial<NodeChange>) => {
    result = { ...result, ...changes }
  }
  const definitions = swapDefinitions(source)
  if (definitions.length) {
    const kept = definitions
      .filter((def) => !def.id || !context.removedProperties.has(guidToString(def.id)))
      .map((def) => {
        const preferred = def.preferredValues?.instanceSwapValues
        if (!preferred) return def
        const values = preferred.filter((value) => {
          const id = value.key && context.resolvePreferred(value.key, value.version)
          return !id || !context.removed.has(id)
        })
        return values.length === preferred.length
          ? def
          : {
              ...def,
              preferredValues: { ...def.preferredValues, instanceSwapValues: values }
            }
      })
    if (kept.length !== definitions.length || kept.some((def, i) => def !== definitions[i]))
      replace({ componentPropDefs: kept })
  }
  const refs = (source.componentPropRefs as ComponentPropRef[] | undefined) ?? []
  const keptRefs = refs.filter(
    (ref) => !ref.defID || !context.removedProperties.has(guidToString(ref.defID))
  )
  if (refs.length !== keptRefs.length) replace({ componentPropRefs: keptRefs })

  return result
}

/** Drop stale override paths; hide only the nested occurrence when its swap target is removed. */
export function cleanComponentReferences(
  record: NodeChange,
  context: CleanupReferences
): { record: NodeChange; hiddenCount: number } {
  let hiddenCount = 0
  const hiddenPaths = new Set<string>()
  const isRemoved = (guid: GUID) => context.removed.has(guidToString(guid))
  const hide = (path: readonly GUID[]): SymbolOverride => {
    const key = path.map(guidToString).join('/')
    if (!hiddenPaths.has(key)) {
      hiddenPaths.add(key)
      hiddenCount++
    }
    return { guidPath: { guids: [...path] }, visible: false } as SymbolOverride
  }
  function clean(source: NodeChange, componentId?: string): NodeChange {
    let result = source
    const replace = (changes: Partial<NodeChange>) => {
      result = { ...result, ...changes }
    }
    const properties = cleanProperties(source, context)
    if (properties !== source) {
      result = properties
    }

    const data = symbolDataOf(source)
    const ownerId = data?.symbolID ? guidToString(data.symbolID) : componentId
    const hidden: SymbolOverride[] = []
    const assignments =
      (source.componentPropAssignments as ComponentPropAssignment[] | undefined) ?? []
    const keptAssignments = assignments.filter((assignment) => {
      const unavailable = context.unavailable(assignedComponent(assignment))
      if (unavailable && assignment.defID && ownerId) {
        for (const target of swapTargets(context.index, ownerId, assignment.defID)) {
          if (target.guid && !isRemoved(target.guid)) hidden.push(hide([target.guid]))
        }
      }
      const slot = assignedSlotContent(assignment.varValue?.value ?? assignment.value)
      return (
        !unavailable &&
        !context.unavailable(slot) &&
        (!assignment.defID || !context.removedProperties.has(guidToString(assignment.defID)))
      )
    })
    if (keptAssignments.length !== assignments.length)
      replace({ componentPropAssignments: keptAssignments })

    const overrides = data?.symbolOverrides ?? []
    const next: SymbolOverride[] = []
    for (const override of overrides) {
      const path = override.guidPath?.guids ?? []
      if (path.some(isRemoved)) {
        continue
      }
      if (context.unavailable(override.overriddenSymbolID)) {
        next.push(hide(path))
        continue
      }
      const nestedOwner = override.overriddenSymbolID
        ? guidToString(override.overriddenSymbolID)
        : overrideComponent(context.index, ownerId, path)
      next.push(clean(override as NodeChange, nestedOwner) as SymbolOverride)
    }
    next.push(...hidden)
    if (
      (data || hidden.length) &&
      (next.length !== overrides.length || next.some((item, i) => item !== overrides[i]))
    )
      replace({ symbolData: { ...data, symbolOverrides: next } as NodeChange['symbolData'] })
    // Derived overrides are a cache; stale paths must not resurrect removed children.
    const derived = source.derivedSymbolData as Array<{ guidPath?: { guids?: GUID[] } }> | undefined
    if (derived) {
      const kept = derived.filter((entry) => !entry.guidPath?.guids?.some(isRemoved))
      if (kept.length !== derived.length) replace({ derivedSymbolData: kept })
    }
    return result
  }
  const cleaned = clean(record, idOf(record))
  return { record: cleaned, hiddenCount }
}
