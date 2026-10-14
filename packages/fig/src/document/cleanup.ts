import type { GUID, NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'

import { parseFigBuffer } from '../archive'
import { createSourceIndex, idOf, parentIdOf } from '../instance-overrides/source-index'
import { patchFigArchive } from '../record-patch'
import { planFigInternalCleanup, type FigInternalCleanupSummary } from './cleanup/internal'
import { childIds, subtreeIds } from './cleanup/tree'
import { componentDependencies, slotContentDependencies } from './component/dependencies'
import { collectSceneDependencies } from './dependency-closure'
import { createResourceResolver } from './resource-reference'

export type FigCleanupChoice = 'keep' | 'unused' | 'internal'
export interface FigCleanupOptions {
  unused: FigCleanupSummary
  internal: FigInternalCleanupSummary
}

export interface FigCleanupSummary {
  componentCount: number
  nodeCount: number
}

export interface FigCleanupPlan extends FigCleanupSummary {
  removed: GUID[]
}

// These describe ownership or history, rather than a live dependency. Ownership is
// handled separately so referencing a component never retains its whole internal page.
const OWNERSHIP_FIELDS = new Set([
  'guid',
  'parentIndex',
  'ancestorPathBeforeDeletion',
  // Page-level handoff annotations can outlive a deleted node, as in Figma's test export.
  // They don't consume its definition or instantiate its content.
  'handoffStatusMap'
])

function referencedIds(record: NodeChange): Set<string> {
  const result = new Set<string>()
  const pending: unknown[] = Object.entries(record)
    .filter(([field]) => !OWNERSHIP_FIELDS.has(field))
    .map(([, value]) => value)
  while (pending.length) {
    const value = pending.pop()
    if (!value || typeof value !== 'object' || ArrayBuffer.isView(value)) continue
    if (
      'sessionID' in value &&
      'localID' in value &&
      typeof value.sessionID === 'number' &&
      typeof value.localID === 'number'
    ) {
      result.add(guidToString({ sessionID: value.sessionID, localID: value.localID }))
    } else {
      pending.push(...Object.values(value))
    }
  }
  return result
}

/** Remove only provably unused internal component trees, never authored pages or assets. */
export function planFigComponentCleanup(records: readonly NodeChange[]): FigCleanupPlan {
  const index = createSourceIndex(records)
  const internal = subtreeIds(
    index,
    records.filter((node) => node.type === 'CANVAS' && node.internalOnly)
  )
  const components = records.filter(
    (node) => node.type === 'SYMBOL' && internal.has(idOf(node) ?? '')
  )
  const definitions = records.filter(
    (node) => (node.type === 'SYMBOL' || node.isStateGroup) && internal.has(idOf(node) ?? '')
  )
  if (!components.length) return { componentCount: 0, nodeCount: 0, removed: [] }

  const closure = collectSceneDependencies(records, undefined, index)
  const resolveResource = createResourceResolver(records)
  // A broken source tree is not a sound basis for irreversible archive pruning.
  if (closure.missingIds.size) return { componentCount: 0, nodeCount: 0, removed: [] }
  const componentContent = subtreeIds(index, definitions)

  const kept = new Set<string>()
  const ancestors = new Set<string>()
  // Non-component content and resources are never cleanup candidates. Their dependencies
  // count too, even when the importer does not currently interpret those fields.
  const pending = [
    ...closure.contentIds,
    ...records.flatMap((node) => {
      const id = idOf(node)
      return id && !componentContent.has(id) ? [id] : []
    })
  ]
  while (pending.length) {
    const id = pending.pop()
    if (!id || kept.has(id)) continue
    const node = index.sources.get(id)
    if (!node) continue
    kept.add(id)
    pending.push(
      ...referencedIds(node),
      ...componentDependencies(node, resolveResource, () => undefined),
      ...slotContentDependencies(node)
    )
    // Retain the complete tree of a referenced object, but do not root an internal page.
    if (componentContent.has(id)) pending.push(...childIds(index, id))
    let parent = parentIdOf(node)
    while (parent && !ancestors.has(parent)) {
      ancestors.add(parent)
      const owner = index.sources.get(parent)
      if (!owner) break
      // Retain all variants when one variant is needed, and any owning component.
      if (owner.type === 'SYMBOL' || owner.isStateGroup) pending.push(parent)
      parent = parentIdOf(owner)
    }
    if (node.isStateGroup) pending.push(...childIds(index, id))
  }

  const removable = definitions.filter((node) => !kept.has(idOf(node) ?? ''))
  const deleted = subtreeIds(index, removable)
  return {
    componentCount: removable.filter((node) => node.type === 'SYMBOL').length,
    nodeCount: deleted.size,
    removed: removable.flatMap((node) => node.guid ?? [])
  }
}

/** Analyze once; accepted cleanup patches untouched records as bytes using the source schema. */
export function prepareFigComponentCleanup(bytes: ArrayBuffer) {
  const parsed = parseFigBuffer(bytes)
  const plan = planFigComponentCleanup(parsed.nodeChanges)
  const internal = planFigInternalCleanup(parsed.nodeChanges)
  const summary: FigCleanupSummary = {
    componentCount: plan.componentCount,
    nodeCount: plan.nodeCount
  }
  const thumbnailPNG = parsed.thumbnailPNG ?? new Uint8Array()
  const metaJSON = parsed.metaJSON ?? '{}'
  return {
    summary,
    options: {
      unused: summary,
      internal: {
        canvasCount: internal.canvasCount,
        componentCount: internal.componentCount,
        instanceCount: internal.instanceCount,
        hiddenInstanceCount: internal.hiddenInstanceCount,
        pageCount: internal.pageCount,
        nodeCount: internal.nodeCount
      }
    } satisfies FigCleanupOptions,
    apply(choice: Exclude<FigCleanupChoice, 'keep'> = 'unused'): Uint8Array {
      const selected = choice === 'internal' ? internal : plan
      if (!selected.removed.length && (choice !== 'internal' || !internal.records.length))
        return new Uint8Array(bytes)
      return patchFigArchive(
        bytes,
        {
          records: choice === 'internal' ? internal.records : [],
          blobs: [],
          removed: selected.removed,
          replaceVariables: false
        },
        { thumbnailPNG, metaJSON, images: [] }
      )
    }
  }
}
