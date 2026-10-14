import { expect, spyOn, test } from 'bun:test'

import { WebFontResolver } from '#core/text/web-fonts'

test('provider catalog loading leaves unrelated requests on the native transport', async () => {
  const nativeFetch = spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'))
  const resolver = new WebFontResolver()
  resolver.setEnabled({ google: true })
  let markStarted: () => void = () => undefined
  let releaseCatalog: () => void = () => undefined
  const started = new Promise<void>((resolve) => {
    markStarted = resolve
  })
  const blocked = new Promise<Response>((resolve) => {
    releaseCatalog = () => resolve(Response.json({ familyMetadataList: [] }))
  })
  const proxied: string[] = []
  resolver.setRemoteFetch(async (url) => {
    proxied.push(url)
    markStarted()
    return blocked
  })
  const loading = resolver.listFamilies('google')

  try {
    await started
    const request = new Request('https://storage.example.com/designs', {
      headers: { Range: 'bytes=0-99' }
    })
    const response = fetch(request)
    expect(nativeFetch).toHaveBeenCalledWith(request, undefined)
    expect(await (await response).text()).toBe('ok')
    expect(proxied).toHaveLength(1)
    expect(new URL(proxied[0]).hostname).toBe('fonts.google.com')
  } finally {
    releaseCatalog()
    await loading
    nativeFetch.mockRestore()
  }
})
