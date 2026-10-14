import { idOf, parentIdOf, type SourceIndex } from '#fig/instance-overrides/source-index'

/** Header-only lookup: component names and their enclosing set/section names, by source page. */
export function componentSearchIndex(
  index: SourceIndex
): Array<{ pageId: string; names: string[] }> {
  const pages = new Map<string, Set<string>>()
  for (const source of index.sources.values()) {
    if (source.type !== 'SYMBOL' && source.type !== 'COMPONENT_SET') continue
    const names = new Set<string>()
    let node = source
    const visited = new Set<string>()
    for (;;) {
      if (node.type === 'CANVAS') {
        const pageId = idOf(node)
        if (pageId) {
          const entries = pages.get(pageId) ?? new Set<string>()
          for (const name of names) entries.add(name)
          pages.set(pageId, entries)
        }
        break
      }
      if (node.name) names.add(node.name)
      const parentId = parentIdOf(node)
      if (!parentId || visited.has(parentId)) break
      visited.add(parentId)
      const parent = index.sources.get(parentId)
      if (!parent) break
      node = parent
    }
  }
  return [...pages].map(([pageId, names]) => ({ pageId, names: [...names] }))
}
