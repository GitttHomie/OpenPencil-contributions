import type { Page } from '@playwright/test'

/** Observe real Save dispatch without writing a file or opening an OS dialog. */
export function captureSavePicker(page: Page) {
  return page.evaluateHandle(() => {
    const original = window.showSaveFilePicker
    const capture = {
      calls: 0,
      restore() {
        window.showSaveFilePicker = original
      }
    }
    window.showSaveFilePicker = async () => {
      capture.calls++
      throw new DOMException('Cancelled test picker', 'AbortError')
    }
    return capture
  })
}

export function editorUIVisible(page: Page) {
  return page.evaluate(() => window.openPencil?.getStore?.().state.showUI)
}
