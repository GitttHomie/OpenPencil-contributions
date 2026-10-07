import { uniq } from 'es-toolkit/array'

import { ResourceCache } from '#core/cache/resource'
import { DEFAULT_FONT_FAMILY } from '#core/constants'
import { fontManager } from '#core/text/fonts'

const familiesCache = new ResourceCache<string, string[]>({ maxEntries: 256 })

export function resolveParagraphFontFamilies(
  primary: string,
  style: string,
  arabicFallbacks: readonly string[] = fontManager.getArabicFallbackFamilies(),
  cjkFallbacks: readonly string[] = fontManager.getCJKFallbackFamilies()
): string[] {
  const renderPrimary = fontManager.renderFamilies(primary, style)
  const renderArabicFallbacks = arabicFallbacks.flatMap((family) =>
    fontManager.renderFamilies(family, 'Regular')
  )
  const renderCJKFallbacks = cjkFallbacks.flatMap((family) =>
    fontManager.renderFamilies(family, 'Regular')
  )
  const key = JSON.stringify([renderPrimary, renderArabicFallbacks, renderCJKFallbacks])
  const cached = familiesCache.peek(key)
  if (cached) return cached
  const families = [...renderPrimary]
  if (primary !== DEFAULT_FONT_FAMILY) families.push(DEFAULT_FONT_FAMILY)
  families.push(...renderArabicFallbacks, ...renderCJKFallbacks)
  const resolved = uniq(families)
  familiesCache.set(key, resolved)
  return resolved
}
