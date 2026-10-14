import type { LibraryAssetDescriptor, LibrarySummary } from '#core/library/index'

export type ComponentCatalogSource = 'document' | 'libraries' | 'all'

export interface ComponentCatalogLibraryAsset {
  libraryId: string
  libraryName: string
  revisionId: string
  enabled: boolean
  priority: number
  asset: LibraryAssetDescriptor
}

export interface ComponentCatalogInsertInput {
  libraryId: string
  revisionId?: string
  assetKey: string
  parentId?: string
  x?: number
  y?: number
  variantValues?: Record<string, string>
}

export interface ComponentCatalog {
  listLibraries(): Promise<LibrarySummary[]>
  listComponents(input: {
    name?: string
    libraryId?: string
    enabledOnly?: boolean
  }): Promise<ComponentCatalogLibraryAsset[]>
  insertComponent(input: ComponentCatalogInsertInput): Promise<{ id: string; componentId: string }>
}

const catalogs = new WeakMap<object, ComponentCatalog>()
const pageLoaders = new WeakMap<object, (pageId: string) => Promise<void>>()

/** Host page loading keeps worker population and document replacement checks in one place. */
export function registerComponentPageLoader(
  owner: object,
  load: (pageId: string) => Promise<void>
): void {
  pageLoaders.set(owner, load)
}

export function getComponentPageLoader(
  owner: object
): ((pageId: string) => Promise<void>) | undefined {
  return pageLoaders.get(owner)
}

export function registerComponentCatalog(owner: object, catalog: ComponentCatalog): () => void {
  catalogs.set(owner, catalog)
  return () => {
    if (catalogs.get(owner) === catalog) catalogs.delete(owner)
  }
}

export function getComponentCatalog(owner: object): ComponentCatalog | undefined {
  return catalogs.get(owner)
}
