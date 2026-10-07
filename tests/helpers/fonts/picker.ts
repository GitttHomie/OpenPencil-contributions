import type { Locator, Page } from '@playwright/test'

export async function mockFontPickerCatalog(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'queryLocalFonts', {
      configurable: true,
      value: async () =>
        Array.from({ length: 104 }, (_, index) => {
          const family = `${String.fromCharCode(65 + Math.floor(index / 4))} Sample ${index % 4}`
          return {
            family,
            fullName: `${family} Regular`,
            postscriptName: family.replaceAll(' ', ''),
            style: 'Regular'
          }
        })
    })
  })
}

export async function fontOptionCenterOffset(option: Locator): Promise<number> {
  return option.evaluate((element) => {
    const viewport = element.closest('[data-reka-combobox-viewport]')
    if (!viewport) throw new Error('Font viewport unavailable')
    const row = element.getBoundingClientRect()
    const bounds = viewport.getBoundingClientRect()
    return Math.abs(row.top + row.height / 2 - (bounds.top + bounds.height / 2))
  })
}

export async function fontPreviewLoaded(page: Page, family: string): Promise<boolean> {
  return page.evaluate(
    (name) => [...document.fonts].some((face) => face.family === name && face.status === 'loaded'),
    family
  )
}
