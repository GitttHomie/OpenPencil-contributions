import {
  createUnifont,
  providers,
  type GoogleFamilyOptions,
  type RemoteFontSource,
  type ResolveFontOptions,
  type Unifont
} from 'unifont'

import type { WebFontProviderId } from '#core/text/web-fonts'

export type WebFontProvider =
  | ReturnType<typeof providers.google>
  | ReturnType<typeof providers.fontsource>
  | ReturnType<typeof providers.bunny>
  | ReturnType<typeof providers.fontshare>
export type WebUnifont = Unifont<[WebFontProvider]>
export type WebFontResolveOptions = Pick<
  ResolveFontOptions<{ google?: GoogleFamilyOptions }>,
  'weights' | 'styles' | 'formats' | 'subsets' | 'options'
>

export const providerFactories = {
  google: providers.google,
  fontsource: providers.fontsource,
  bunny: providers.bunny,
  fontshare: providers.fontshare
} satisfies Record<WebFontProviderId, () => WebFontProvider>

export async function createProviderUnifont(
  provider: WebFontProviderId,
  onCatalog?: (data: unknown) => void
): Promise<WebUnifont> {
  const cache = new Map<string, unknown>()
  return createUnifont([providerFactories[provider]()], {
    throwOnError: false,
    storage: {
      getItem: (key) => cache.get(key) ?? null,
      setItem(key, value) {
        cache.set(key, value)
        if (key.endsWith(`${provider}:meta.json`) && typeof value === 'object') {
          onCatalog?.(value.data)
        }
      }
    }
  })
}

export function isRemoteFontSource(
  source: RemoteFontSource | { name: string }
): source is RemoteFontSource {
  return 'url' in source
}
