import { createResourceResolver } from '#fig/document/resource-reference'
import { createSourceIndex, idOf, parentIdOf } from '#fig/instance-overrides/source-index'

import type { GUID, NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'

import { collectRemovedProperties } from './properties'
import { cleanComponentReferences, swapTargets } from './references'
import { childIds, resourceTreeIds, subtreeIds } from './tree'

export interface FigInternalCleanupSummary {
  canvasCount: number
  componentCount: number
  instanceCount: number
  hiddenInstanceCount: number
  pageCount: number
  nodeCount: number
}

export interface FigInternalCleanupPlan extends FigInternalCleanupSummary {
  removed: GUID[]
  records: NodeChange[]
}

/** Explicit destructive alternative: remove internal pages and their linked instance layers. */
export function planFigInternalCleanup(records: readonly NodeChange[]): FigInternalCleanupPlan {
  const index = createSourceIndex(records)
  const pages = records.filter((node) => node.type === 'CANVAS' && node.internalOnly)
  const internal = subtreeIds(index, pages)
  // Internal pages also own document variables and shared styles. Cleanup removes
  // design content, not these resources or the ownership chain needed to read them.
  const resources = resourceTreeIds(index, records)
  const deleted = new Set([...internal].filter((id) => !resources.has(id)))
  const unavailable = (guid: GUID | undefined) =>
    !!guid && (deleted.has(guidToString(guid)) || !index.sources.has(guidToString(guid)))
  const pending = [...deleted]
  const removedProperties = collectRemovedProperties(index, unavailable, (id, propertyId) => {
    pending.push(...swapTargets(index, id, propertyId).flatMap((target) => idOf(target) ?? []))
  })
  const users = new Map<string, string[]>()
  for (const node of records) {
    const id = idOf(node)
    if (!id) continue
    if (node.type === 'INSTANCE' && node.symbolData?.symbolID) {
      const componentId = guidToString(node.symbolData.symbolID)
      const instances = users.get(componentId) ?? []
      instances.push(id)
      users.set(componentId, instances)
      if (unavailable(node.symbolData.symbolID)) pending.push(id)
    }
  }
  // The queue also removes aliases of deleted instances and each deleted layer's contents.
  const visited = new Set<string>()
  while (pending.length) {
    const id = pending.pop()
    if (!id || visited.has(id) || resources.has(id)) continue
    visited.add(id)
    deleted.add(id)
    pending.push(...childIds(index, id), ...(users.get(id) ?? []))
  }
  const resolve = createResourceResolver(records)
  const patched: NodeChange[] = []
  let hiddenInstanceCount = 0
  const affectedPages = new Set<string>()
  const markPage = (record: NodeChange) => {
    const seen = new Set<string>()
    let current: NodeChange | undefined = record
    while (current) {
      const id = idOf(current)
      if (!id || seen.has(id)) break
      seen.add(id)
      if (current.type === 'CANVAS') {
        if (!current.internalOnly) affectedPages.add(id)
        break
      }
      current = index.sources.get(parentIdOf(current) ?? '')
    }
  }
  for (const record of records) {
    if (deleted.has(idOf(record) ?? '')) {
      if (!internal.has(idOf(record) ?? '')) markPage(record)
      continue
    }
    const result = cleanComponentReferences(record, {
      index,
      removed: deleted,
      removedProperties,
      unavailable,
      resolvePreferred: (key, version) => resolve({ assetRef: { key, version } })
    })
    if (result.record !== record) {
      patched.push(result.record)
      markPage(record)
    }
    hiddenInstanceCount += result.hiddenCount
  }
  return {
    canvasCount: pages.filter((page) => deleted.has(idOf(page) ?? '')).length,
    componentCount: records.filter(
      (node) => node.type === 'SYMBOL' && internal.has(idOf(node) ?? '')
    ).length,
    instanceCount: records.filter(
      (node) =>
        node.type === 'INSTANCE' && deleted.has(idOf(node) ?? '') && !internal.has(idOf(node) ?? '')
    ).length,
    hiddenInstanceCount,
    pageCount: affectedPages.size,
    nodeCount: deleted.size + patched.length,
    removed: records.flatMap((node) =>
      node.guid && deleted.has(idOf(node) ?? '') ? [node.guid] : []
    ),
    records: patched
  }
}
