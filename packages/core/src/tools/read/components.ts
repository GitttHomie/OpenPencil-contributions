import * as v from 'valibot'

import {
  readerComponentSearchPages,
  recoverReaderPage
} from '#core/kiwi/fig/session/document-state'
import { getComponentCatalog, getComponentPageLoader } from '#core/tools/component-catalog'
import { toolNumber } from '#core/tools/input'
import { defineTool } from '#core/tools/schema'

interface DocumentComponentResult {
  id: string
  name: string
  type: string
  page: string
  source: 'document'
  variants?: { id: string; name: string; width: number; height: number }[]
  variantCount?: number
}

interface LibraryComponentResult {
  libraryId: string
  libraryName: string
  revisionId: string
  assetKey: string
  name: string
  type: string
  description: string
  source: 'library'
  enabled: boolean
  priority: number
}

export const getComponents = defineTool({
  name: 'get_components',
  description:
    'List reusable components from the document and enabled component libraries, optionally filtered by name. Searches unopened document pages too; use a semantic name to load only relevant component pages.',
  execution: { kind: 'async', mutation: 'none' },
  input: v.strictObject({
    name: v.optional(
      v.pipe(v.string(), v.description('Filter by name (case-insensitive substring)'))
    ),
    source: v.optional(
      v.pipe(v.picklist(['all', 'document', 'libraries']), v.description('Component source')),
      'all'
    ),
    library_id: v.optional(
      v.pipe(v.string(), v.description('Filter library components by library ID'))
    ),
    include_variants: v.optional(
      v.pipe(
        v.boolean(),
        v.description(
          'Include up to 12 direct variant IDs, names and sizes per document component set'
        )
      ),
      false
    ),
    limit: v.optional(
      toolNumber(
        v.pipe(v.number(), v.integer(), v.minValue(0), v.description('Max results (default: 50)'))
      )
    )
  }),
  execute: async (figma, args) => {
    const limit = args.limit ?? 50
    const source = args.source
    const nameFilter = args.name?.toLowerCase()
    const documentComponents: DocumentComponentResult[] = []

    if (source !== 'libraries') {
      const load = getComponentPageLoader(figma)
      for (const pageId of readerComponentSearchPages(figma.graph, args.name)) {
        if (limit === 0) break
        if (load) await load(pageId)
        else recoverReaderPage(figma.graph, pageId)
        const matches = [...figma.graph.getAllNodes()].filter(
          (node) =>
            (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') &&
            (!nameFilter || node.name.toLowerCase().includes(nameFilter))
        )
        if (matches.length >= limit) break
      }
      for (const page of figma.root.children) {
        if (documentComponents.length >= limit) break
        page.findAll((node) => {
          if (documentComponents.length >= limit) return false
          if (node.type !== 'COMPONENT' && node.type !== 'COMPONENT_SET') return false
          if (nameFilter && !node.name.toLowerCase().includes(nameFilter)) return false
          const variants =
            args.include_variants && node.type === 'COMPONENT_SET'
              ? node.children.filter((child) => child.type === 'COMPONENT')
              : undefined
          const component: DocumentComponentResult = {
            id: node.id,
            name: node.name,
            type: node.type,
            page: page.name,
            source: 'document'
          }
          if (variants) {
            component.variantCount = variants.length
            component.variants = variants.slice(0, 12).map((variant) => ({
              id: variant.id,
              name: variant.name,
              width: variant.width,
              height: variant.height
            }))
          }
          documentComponents.push(component)
          return false
        })
      }
    }

    const catalog = getComponentCatalog(figma.graph)
    const libraryComponents: LibraryComponentResult[] = []
    if (source !== 'document' && catalog) {
      const assets = await catalog.listComponents({
        name: args.name,
        libraryId: args.library_id,
        enabledOnly: true
      })
      libraryComponents.push(
        ...assets.map(({ libraryId, libraryName, revisionId, enabled, priority, asset }) => ({
          libraryId,
          libraryName,
          revisionId,
          assetKey: asset.key,
          name: asset.name,
          type: asset.type,
          description: asset.description,
          source: 'library' as const,
          enabled,
          priority
        }))
      )
    }

    const components = [...libraryComponents, ...documentComponents]
      .sort((left, right) => {
        const leftPriority = 'priority' in left ? left.priority : -1
        const rightPriority = 'priority' in right ? right.priority : -1
        return rightPriority - leftPriority || left.name.localeCompare(right.name)
      })
      .slice(0, limit)
    return { count: components.length, components }
  }
})
