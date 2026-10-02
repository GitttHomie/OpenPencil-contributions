import type { Page } from '@playwright/test'

export async function mockLocalFont(
  page: Page,
  data: Buffer,
  beforeDownload?: () => Promise<void>
) {
  const counts = { reads: 0 }
  await page.route('**/test-local-font.ttf', async (route) => {
    counts.reads++
    await beforeDownload?.()
    await route.fulfill({ body: data, contentType: 'font/ttf' })
  })
  await page.addInitScript(() => {
    Object.defineProperty(window, 'queryLocalFonts', {
      configurable: true,
      value: async () => [
        {
          family: 'Academy Engraved LET',
          fullName: 'Academy Engraved LET Plain',
          postscriptName: 'AcademyEngravedLetPlain',
          style: 'Regular',
          blob: async () => (await fetch('/test-local-font.ttf')).blob()
        }
      ]
    })
  })
  return counts
}
