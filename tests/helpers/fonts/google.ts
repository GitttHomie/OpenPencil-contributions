import type { Page, Route } from '@playwright/test'

/** Route-owned counts live in the runner, not on window or in a patched fetch. */
export async function mockGoogleFonts(
  page: Page,
  families = ['Inter', 'OpenPencil Google Font'],
  options: { fontData?: Buffer; weights?: number[]; beforeDownload?: () => Promise<void> } = {}
) {
  const counts = { metadata: 0, previews: 0, requestedWeights: [] as number[] }
  const headers = { 'access-control-allow-origin': '*' }
  const pattern =
    /^https:\/\/(fonts\.gstatic\.com\/open-pencil-tests\/|fonts\.google\.com\/metadata\/fonts|fonts\.googleapis\.com\/css2)/
  async function handle(route: Route) {
    const url = new URL(route.request().url())
    if (url.hostname === 'fonts.gstatic.com') {
      counts.previews++
      await options.beforeDownload?.()
      await route.fulfill({ status: 200, body: options.fontData ?? Buffer.alloc(8), headers })
    } else if (url.hostname === 'fonts.google.com') {
      counts.metadata++
      await route.fulfill({
        headers,
        json: {
          familyMetadataList: families.map((family) => ({
            family,
            axes: [],
            fonts: Object.fromEntries(
              (options.weights ?? [400]).map((weight) => [String(weight), {}])
            )
          }))
        }
      })
    } else {
      const [family = 'Inter', axesAndValues = ''] = (
        url.searchParams.get('family') ?? 'Inter'
      ).split(':')
      const [axes = '', values = ''] = axesAndValues.split('@')
      const weightIndex = axes.split(',').indexOf('wght')
      const weight = Number(values.split(';')[0].split(',')[weightIndex] ?? 400)
      counts.requestedWeights.push(weight)
      await route.fulfill({
        headers,
        contentType: 'text/css',
        body: `@font-face { font-family: '${family}'; font-style: normal; font-weight: ${weight}; src: url(https://fonts.gstatic.com/open-pencil-tests/${encodeURIComponent(family)}-${weight}.ttf) format('truetype'); }`
      })
    }
  }
  const pending = new Set<Promise<void>>()
  async function trackedHandle(route: Route) {
    const request = handle(route)
    pending.add(request)
    try {
      await request
    } finally {
      pending.delete(request)
    }
  }
  await page.route(pattern, trackedHandle)
  return {
    counts,
    async dispose() {
      await Promise.allSettled(pending)
      await page.unroute(pattern, trackedHandle)
    }
  }
}
