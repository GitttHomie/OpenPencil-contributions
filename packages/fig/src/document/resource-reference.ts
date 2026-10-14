import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'

/** Resolve local identities first; reject duplicate library identities only when referenced. */
export function createResourceResolver(resources: readonly NodeChange[]) {
  const keys = new Map<string, Map<string, string | null>>()
  for (const resource of resources) {
    if (!resource.guid || typeof resource.key !== 'string') continue
    const versions = keys.get(resource.key) ?? new Map<string, string | null>()
    const version = typeof resource.version === 'string' ? resource.version : ''
    const id = guidToString(resource.guid)
    versions.set(version, versions.has(version) && versions.get(version) !== id ? null : id)
    keys.set(resource.key, versions)
  }
  return (reference: NodeChange['variableSetID']): string | undefined => {
    if (reference?.guid) return guidToString(reference.guid)
    const asset = reference?.assetRef
    if (!asset) return undefined
    const versions = keys.get(asset.key)
    let id: string | null | undefined
    if (asset.version) id = versions?.get(asset.version)
    else if (versions?.has('')) id = versions.get('')
    else if (versions?.size === 1) id = versions.values().next().value
    if (id === null)
      throw new Error(`Ambiguous resource ${asset.key} version ${asset.version ?? ''}`)
    return id
  }
}
