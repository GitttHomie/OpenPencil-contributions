import { idOf, parentIdOf, type SourceIndex } from '#fig/instance-overrides/source-index'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

export function childIds(index: SourceIndex, id: string): string[] {
  return (index.children.get(id) ?? []).flatMap((node) => idOf(node) ?? [])
}

export function subtreeIds(index: SourceIndex, roots: readonly NodeChange[]): Set<string> {
  const result = new Set<string>()
  const pending = roots.flatMap((node) => idOf(node) ?? [])
  while (pending.length) {
    const id = pending.pop()
    if (!id || result.has(id)) continue
    result.add(id)
    pending.push(...childIds(index, id))
  }
  return result
}

/** Resources and their ownership chains survive removal of embedded design content. */
export function resourceTreeIds(index: SourceIndex, records: readonly NodeChange[]): Set<string> {
  const resources = subtreeIds(
    index,
    records.filter(
      (node) => node.type === 'VARIABLE' || node.type === 'VARIABLE_SET' || !!node.styleType
    )
  )
  for (const id of resources) {
    let parent = parentIdOf(index.sources.get(id) ?? {})
    while (parent && !resources.has(parent)) {
      resources.add(parent)
      parent = parentIdOf(index.sources.get(parent) ?? {})
    }
  }
  return resources
}
